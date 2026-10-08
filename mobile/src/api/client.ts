// The single HTTP layer for the app. Every request goes to the same backend the
// website uses, carrying the session JWT as `Authorization: Bearer` (the server
// accepts it alongside the web's cookie). Timeouts, error mapping and expired
// sessions are handled here so screens never call fetch directly.

import { API_URL, REQUEST_TIMEOUT_MS } from "@/config/env";
import { ApiError, kindForStatus } from "./errors";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  token = t;
}
export function getAuthToken() {
  return token;
}
/** Registered by the auth provider: called when an authenticated request gets a 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Don't treat a 401 as an expired session (e.g. a wrong password on login). */
  skipAuthRedirect?: boolean;
};

export function buildUrl(path: string, query?: Query) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

/** Performs the request and maps every failure to ApiError. Returns the raw Response. */
export async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);

  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-riff-client": "native",
    ...(opts.body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch {
    throw timedOut ? new ApiError("timeout", "Request timed out") : new ApiError("network", "Network request failed");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }

  if (!res.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = undefined;
    }
    const kind = kindForStatus(res.status);
    if (kind === "unauthorized" && token && !opts.skipAuthRedirect) onUnauthorized?.();
    const message = typeof body?.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(kind, message, res.status, body);
  }
  return res;
}

/** JSON request. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts);
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("server", "Unreadable server response", res.status);
  }
}

export const get = <T>(path: string, query?: Query) => api<T>(path, { query });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });

/** A file picked on the device (image picker / document picker). */
export type LocalFile = { uri: string; name: string; mimeType: string };

/** multipart/form-data upload, e.g. POST /api/uploads with field `file`. */
export function upload<T>(path: string, file: LocalFile, fields: Record<string, string> = {}, field = "file") {
  const form = new FormData();
  // React Native's FormData accepts {uri,name,type} for files.
  form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return api<T>(path, { method: "POST", body: form, timeoutMs: 120_000 });
}
