"use client";

import { useState } from "react";

// Deleting an account is irreversible, so the form is deliberately awkward:
// it stays collapsed until asked for, then requires both the password and the
// word DELETE typed out. The friction is the point.
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = password.length > 0 && confirm === "DELETE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(body.error ?? "Could not delete your account. Please try again.");
        setLoading(false);
        return;
      }

      // A full reload, not a router push: every cached server component in
      // memory belongs to a user that no longer exists.
      window.location.href = body.billingNeedsAttention
        ? "/account/deleted?billing=1"
        : "/account/deleted";
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs text-[var(--muted)] mb-1 block" htmlFor="del-pw">
          Confirm your password
        </label>
        <input
          id="del-pw"
          type="password"
          autoComplete="current-password"
          className="field w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-[var(--muted)] mb-1 block" htmlFor="del-confirm">
          Type <strong>DELETE</strong> to confirm
        </label>
        <input
          id="del-confirm"
          className="field w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
        />
      </div>

      {err && <p className="text-sm text-[var(--brand-2)]">{err}</p>}

      <div className="flex gap-2">
        <button
          className="btn"
          style={{ background: "var(--brand-2)", color: "white" }}
          disabled={!ready || loading}
        >
          {loading ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loading}
          onClick={() => {
            setOpen(false);
            setPassword("");
            setConfirm("");
            setErr(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
