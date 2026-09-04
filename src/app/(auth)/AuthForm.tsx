"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readReferralCookie } from "@/components/ReferralCapture";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  const [code, setCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    // Attribution rides along with the account creation itself, so the source
    // is committed in the same transaction as the user — never a follow-up call
    // that could fail and silently lose the credit.
    const ref = mode === "signup" ? readReferralCookie() : null;
    const body =
      mode === "login"
        ? { email, password, ...(mfaStep ? { code } : {}) }
        : { email, password, stageName, ...(ref ? { ref } : {}) };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.mfaRequired) {
      // Password ok — prompt for the second factor.
      setMfaStep(true);
      setLoading(false);
      return;
    }
    if (res.ok) {
      // `next` is already validated as a same-site path by safeNextPath().
      router.push(next ?? "/dashboard");
      router.refresh();
    } else {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="card p-8 w-full max-w-sm">
        <Link href="/" className="font-bold text-lg flex items-center gap-2 mb-6">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>
        <h1 className="text-2xl font-bold mb-1">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          {mode === "login" ? "Pick up where you left off." : "Start your artist growth journey."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mfaStep ? (
            <>
              <p className="text-sm text-[var(--muted)]">Enter the 6-digit code from your authenticator app.</p>
              <Field label="Authentication code">
                <input className="input tracking-[0.4em] text-center" inputMode="numeric" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
              </Field>
            </>
          ) : (
            <>
              {mode === "signup" && (
                <Field label="Artist / stage name">
                  <input className="input" value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="e.g. Nova" />
                </Field>
              )}
              <Field label="Email">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </Field>
              <Field label="Password">
                <input className="input" type="password" required minLength={mode === "signup" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-[var(--brand-2)]">{error}</p>}

          <button className="btn btn-primary w-full py-3" disabled={loading}>
            {loading ? "Please wait…" : mfaStep ? "Verify" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-[var(--muted)] mt-5 text-center">
          {mode === "login" ? (
            <>No account? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-[var(--accent)]">Sign up</Link></>
          ) : (
            <>Already have one? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-[var(--accent)]">Log in</Link></>
          )}
        </p>
      </div>

      <style>{`.input{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.625rem;padding:.625rem .75rem;font-size:.9rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--brand)}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)] mb-1 block">{label}</span>
      {children}
    </label>
  );
}
