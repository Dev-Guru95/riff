"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";

const PASSWORD_MIN = 8;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort || mismatch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        // The password changed but no session was created — send them to log in
        // with the new one rather than silently signing them in from a link.
        setTimeout(() => router.push("/login"), 2200);
      } else {
        setError(d.error ?? "Could not reset your password.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="text-2xl font-bold mb-1">Password changed</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          You can now log in with your new password. Taking you there…
        </p>
        <Link href="/login" className="btn btn-primary w-full py-3">Log in</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Choose a new password</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Make it at least {PASSWORD_MIN} characters. This link only works once.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password">
          <input
            className="input"
            type="password"
            required
            autoFocus
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            className="input"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {tooShort && <p className="text-sm text-[var(--muted)]">At least {PASSWORD_MIN} characters.</p>}
        {mismatch && <p className="text-sm text-[var(--brand-2)]">Those don&apos;t match.</p>}
        {error && <p className="text-sm text-[var(--brand-2)]">{error}</p>}

        <button className="btn btn-primary w-full py-3" disabled={loading || tooShort || mismatch || !password}>
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>

      <p className="text-sm text-[var(--muted)] mt-5 text-center">
        Link expired? <Link href="/forgot-password" className="text-[var(--accent)]">Request a new one</Link>
      </p>
    </>
  );
}
