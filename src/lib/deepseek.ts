// DeepSeek chat-completion client (OpenAI-compatible API). Shared by the AI coach,
// career roadmap generator, and assignment reviewer. When DEEPSEEK_API_KEY is unset
// the callers fall back to deterministic mocks so the platform runs fully offline.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** True when a DeepSeek key is configured; callers use mocks otherwise. */
export function hasDeepseek(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

/**
 * Single round-trip chat completion against DeepSeek. `system` is prepended as a
 * system message. Set `json` to request a strict JSON object back (the prompt must
 * mention JSON, which our callers' system prompts do). Throws on any non-2xx so
 * callers can degrade to their mock.
 */
export async function deepseekChat(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  json?: boolean;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");
  const model = process.env.AI_MODEL || "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
