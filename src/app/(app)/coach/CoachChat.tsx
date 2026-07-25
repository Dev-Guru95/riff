"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { id: string; role: string; content: string };

// Monotonic client-side id for optimistic messages. Module-scoped counter avoids
// impure Date.now() inside the component (react-hooks/purity).
let msgSeq = 0;
const clientMsgId = (prefix: string) => `${prefix}-${msgSeq++}`;

function FeedbackButtons({ messageId }: { messageId: string }) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  async function rate(feedback: "up" | "down") {
    const next = rated === feedback ? null : feedback;
    setRated(next);
    await fetch(`/api/coach/messages/${messageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feedback: next }),
    });
  }
  return (
    <div className="flex gap-1 mt-1 ml-1">
      <button onClick={() => rate("up")} className={`text-xs ${rated === "up" ? "opacity-100" : "opacity-40 hover:opacity-80"}`} aria-label="Helpful">👍</button>
      <button onClick={() => rate("down")} className={`text-xs ${rated === "down" ? "opacity-100" : "opacity-40 hover:opacity-80"}`} aria-label="Not helpful">👎</button>
    </div>
  );
}

const SUGGESTIONS = [
  "What should I focus on this week?",
  "Help me plan my next release",
  "How do I grow my fanbase?",
  "Review my branding strategy",
];

export function CoachChat({ threadId, initialMessages }: { threadId: string; initialMessages: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { id: clientMsgId("u"), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      // Non-stream error (rate limit / auth / validation) returns JSON.
      const ctype = res.headers.get("content-type") ?? "";
      if (!res.ok || !ctype.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => [...m, { id: clientMsgId("e"), role: "assistant", content: data.error ?? "Something went wrong." }]);
        return;
      }

      // Stream the reply token-by-token.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let msgId = clientMsgId("a");
      let acc = "";
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.replace(/^data: /, "").trim();
          if (!line) continue;
          const payload = JSON.parse(line);
          if (payload.id) {
            msgId = payload.id;
            if (!started) {
              started = true;
              setMessages((m) => [...m, { id: msgId, role: "assistant", content: "" }]);
            }
          } else if (payload.delta != null) {
            acc += payload.delta;
            setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, content: acc } : x)));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 card overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-[var(--muted)] mb-4">Ask me anything about growing your music career.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-xs px-3 py-2 rounded-full bg-[var(--surface-2)] hover:bg-[var(--border)] transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] text-white rounded-br-sm"
                  : "bg-[var(--surface-2)] rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
            {m.role === "assistant" && !m.id.startsWith("e-") && <FeedbackButtons messageId={m.id} />}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface-2)] px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-[var(--muted)]">Coach is thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-[var(--border)] p-3 flex gap-2"
      >
        <input
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
          placeholder="Message your coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button className="btn btn-primary px-5" disabled={loading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
