"use client";

import { useEffect, useState } from "react";
import type { SharePayload } from "@/lib/share";

/**
 * Share-to-Skool. Opens a preview of a beautiful achievement card, copies the
 * prewritten caption to the clipboard, and opens the Skool community so the
 * artist can paste + post. Deliberately one-tap, student-initiated — it never
 * claims to auto-post (Skool has no public post API).
 */
export function ShareToSkool({
  share,
  label = "Share to Skool",
  size = "md",
  variant = "primary",
}: {
  share: SharePayload;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function copyAndOpen() {
    // Open Skool FIRST, synchronously, so the click's user-gesture token is still
    // live — awaiting the clipboard before this would let popup blockers kill it.
    window.open(share.url, "_blank", "noopener,noreferrer");
    // Then copy the caption (fire-and-forget; clipboard may be unavailable on
    // insecure origins — that's fine, the tab still opened).
    navigator.clipboard?.writeText(share.caption).then(() => setCopied(true)).catch(() => {});
  }

  const btnCls =
    variant === "primary"
      ? "btn btn-primary"
      : "btn btn-ghost";
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-xs" : "";

  return (
    <>
      <button className={`${btnCls} ${sizeCls}`} onClick={() => setOpen(true)}>
        <span>🎉</span> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Share to the community"
        >
          <div className="card p-6 w-full max-w-sm animate-pop" onClick={(e) => e.stopPropagation()}>
            {/* Achievement card preview */}
            <div
              className="rounded-2xl p-6 text-center text-white mb-5"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
            >
              <div className="text-5xl mb-2">{share.emoji}</div>
              <div className="text-lg font-bold leading-tight">{share.headline}</div>
              <div className="text-xs opacity-80 mt-2">on Riff · Soundring</div>
            </div>

            <p className="text-xs text-[var(--muted)] mb-1">Your post</p>
            <div className="card bg-[var(--surface-2)] p-3 text-sm mb-4">{share.caption}</div>

            <button className="btn btn-primary w-full py-3" onClick={copyAndOpen}>
              {copied ? "✓ Caption copied — opening Skool…" : "Copy caption & open Skool →"}
            </button>
            <p className="text-[11px] text-[var(--muted)] text-center mt-3">
              We copied your caption. Paste it into the community and hit post to share your win.
            </p>
            <button className="btn btn-ghost w-full py-2 mt-2 text-sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
