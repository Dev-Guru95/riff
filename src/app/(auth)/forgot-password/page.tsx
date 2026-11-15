"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setSent(true);
      else setError(d.error ?? "Could not send the reset email.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="card p-8 w-full max-w-sm">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 mb-6">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>

        {sent ? (
          <>
            <h1 className="text-2xl font-bold mb-1">Check your email</h1>
            {/* Deliberately says "if ... exists": confirming the address would
                let anyone test which emails have Riff accounts. */}
            <p className="text-sm text-[var(--muted)] mb-6">
              If an account exists for <strong className="text-[var(--foreground)]">{email}</strong>, we&apos;ve sent a
              link to reset your password. It expires in an hour and works once.
            </p>
            <p className="text-sm text-[var(--muted)]">
              Didn&apos;t get it? Check spam, or{" "}
              <button type="button" className="text-[var(--accent)]" onClick={() => setSent(false)}>
                try a different address
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
            <p className="text-sm text-[var(--muted)] mb-6">
              Enter your email and we&apos;ll send you a link to choose a new one.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </Field>
              {error && <p className="text-sm text-[var(--brand-2)]">{error}</p>}
              <button className="btn btn-primary w-full py-3" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <p className="text-sm text-[var(--muted)] mt-5 text-center">
          Remembered it? <Link href="/login" className="text-[var(--accent)]">Log in</Link>
        </p>
      </div>
    </main>
  );
}
