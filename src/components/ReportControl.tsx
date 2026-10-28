"use client";

// The ⚑ control: report content to the moderators, and optionally block whoever
// wrote it. Used on AI Coach replies and on board card comments, so the website
// offers the same thing the mobile app does (mobile/src/components/moderation).
//
// Posts to /api/community/report, which lands in the queue staff work from at
// /admin/moderation. Blocking toggles /api/community/block; the server then
// hides that artist's comments from the blocker.

import { useState } from "react";
import { REPORT_REASONS, type ReportReasonKey } from "@/lib/constants";

type Props = {
  targetType: "coach_message" | "comment" | "user";
  targetId: string;
  /** Dialog heading, e.g. "Report this AI Coach reply". */
  title: string;
  /** The artist who wrote it, when a person did. Omit for AI output. */
  authorId?: string | null;
  authorName?: string;
  /** Called after a successful block, so the caller can refresh. */
  onBlocked?: () => void;
  className?: string;
};

export function ReportControl({ targetType, targetId, title, authorId, authorName, onBlocked, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonKey | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // "Something else" is only useful if the reporter can say what else it is.
  const needsDetail = reason === "other";
  const ready = reason !== null && (!needsDetail || detail.trim().length >= 3);

  function reset() {
    setOpen(false);
    setReason(null);
    setDetail("");
    setError(null);
    setSent(false);
  }

  async function submit() {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/community/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, detail: detail.trim() || undefined }),
    });
    setSending(false);
    if (!res.ok) {
      setError("We couldn't send that report. Please try again.");
      return;
    }
    setSent(true);
  }

  async function block() {
    if (!authorId) return;
    const res = await fetch("/api/community/block", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blockedId: authorId }),
    });
    if (!res.ok) {
      setError("We couldn't block them. Please try again.");
      return;
    }
    reset();
    onBlocked?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        className={className ?? "text-xs opacity-40 hover:opacity-90"}
      >
        ⚑
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && reset()}
        >
          <div className="card p-5 w-full max-w-md space-y-3">
            {sent ? (
              <>
                <h2 className="font-semibold">Thanks — that&apos;s with our moderators</h2>
                <p className="text-sm text-[var(--muted)]">
                  They review every report and can remove the content
                  {targetType === "coach_message" ? " and retrain the coach." : " or suspend the account."}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  {authorId && (
                    <button type="button" className="btn btn-ghost text-sm" onClick={() => void block()}>
                      Also block {authorName ?? "this artist"}
                    </button>
                  )}
                  <button type="button" className="btn btn-primary text-sm" onClick={reset}>Done</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-[var(--muted)]">
                  Tell us what is wrong with it. Reports go to our moderators, who can remove the content
                  {targetType === "coach_message" ? " and retrain the coach." : " or suspend the account."}
                </p>

                <div role="radiogroup" aria-label="Reason" className="space-y-1">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.key}
                      className="flex items-center gap-2 text-sm px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--surface-2)]"
                    >
                      <input
                        type="radio"
                        name={`report-${targetId}`}
                        checked={reason === r.key}
                        onChange={() => setReason(r.key)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                <textarea
                  className="field w-full text-sm"
                  rows={3}
                  maxLength={500}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  aria-label="More detail"
                  placeholder={needsDetail ? "What is wrong with it?" : "Anything else we should know? (optional)"}
                />

                {error && <p className="text-sm text-[var(--brand-2)]" aria-live="polite">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost text-sm" onClick={reset} disabled={sending}>Cancel</button>
                  <button type="button" className="btn btn-primary text-sm" onClick={() => void submit()} disabled={!ready || sending}>
                    {sending ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
