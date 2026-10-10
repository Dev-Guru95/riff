// Streams a coach reply from POST /api/coach/threads/:id/messages.
//
// The route answers failures (401/402/403/404/422/429) as plain JSON before any
// stream starts, and success as `text/event-stream`:
//   data: {"id":"<assistantMessageId>"}\n\n
//   data: {"delta":"Hey"}\n\n …
//   data: {"done":true}\n\n
//
// React Native's built-in fetch can't read a body incrementally, so this uses
// `fetch` from `expo/fetch` (WinterCG fetch with a streaming ReadableStream body,
// SDK 57). This is the one place outside api/client.ts that calls fetch: the
// shared client only returns parsed JSON. Same URL builder, Bearer token and
// x-riff-client header as every other request.

import { fetch as streamingFetch } from "expo/fetch";

import { buildUrl, get, getAuthToken } from "@/api/client";
import { ApiError, kindForStatus } from "@/api/errors";

type Handlers = {
  /** The assistant message id (first event). */
  onId: (id: string) => void;
  /** Each word / whitespace token, in order. */
  onDelta: (delta: string) => void;
};

/** Thrown when the request succeeded but the body could not be streamed. */
export class StreamUnavailableError extends Error {}

/** Time allowed for the reply to start: the server generates the whole answer before streaming. */
const START_TIMEOUT_MS = 90_000;

/**
 * Incremental SSE parser. Handles events split across chunks, several events in
 * one chunk, CRLF line endings, "data:" with or without the space, and
 * multi-line data fields (joined with "\n", per the SSE spec).
 */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";
  const flushEvent = (raw: string) => {
    const data = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n")
      .trim();
    if (data) onData(data);
  };
  return {
    push(chunk: string) {
      buffer += chunk.replace(/\r\n?/g, "\n");
      let idx = buffer.indexOf("\n\n");
      while (idx !== -1) {
        flushEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf("\n\n");
      }
    },
    /** A final event without the trailing blank line still counts. */
    end() {
      if (buffer.trim()) flushEvent(buffer);
      buffer = "";
    },
  };
}

export async function streamCoachReply(threadId: string, content: string, { onId, onDelta }: Handlers) {
  const token = getAuthToken();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, START_TIMEOUT_MS);
  let res: Awaited<ReturnType<typeof streamingFetch>>;
  try {
    res = await streamingFetch(buildUrl(`/api/coach/threads/${threadId}/messages`), {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "x-riff-client": "native",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    });
  } catch {
    throw timedOut ? new ApiError("timeout", "Request timed out") : new ApiError("network", "Network request failed");
  } finally {
    clearTimeout(timer);
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!res.ok || !ctype.includes("text/event-stream")) {
    let body: Record<string, unknown> | undefined;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = undefined;
    }
    const status = res.ok ? 500 : res.status;
    if (status === 401) {
      // Route the expired session through the shared client so the app's 401
      // handler signs out exactly as it does for every other request.
      await get("/api/mobile/me").catch(() => {});
    }
    const message = typeof body?.error === "string" ? body.error : "Something went wrong.";
    throw new ApiError(kindForStatus(status), message, status, body);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new StreamUnavailableError("No response body");

  let done = false;
  const parser = createSseParser((data) => {
    let payload: { id?: string; delta?: string; done?: boolean };
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (payload.id) onId(payload.id);
    else if (payload.delta != null) onDelta(String(payload.delta));
    else if (payload.done) done = true;
  });
  const decoder = new TextDecoder();
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.push(decoder.decode(chunk.value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.end();
  } catch {
    // The connection dropped mid-reply. Both messages were saved before the
    // stream began, so the caller reloads them from the server.
    throw new StreamUnavailableError("Stream interrupted");
  } finally {
    if (done) void reader.cancel().catch(() => {});
  }
}
