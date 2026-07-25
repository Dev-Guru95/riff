"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MfaManager({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
    const d = await res.json();
    setLoading(false);
    if (res.ok) setSetup(d);
    else setMsg({ ok: false, text: d.error ?? "Failed" });
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/mfa/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { setMsg({ ok: true, text: "MFA enabled ✓" }); setSetup(null); setCode(""); router.refresh(); }
    else setMsg({ ok: false, text: d.error ?? "Invalid code" });
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/mfa/disable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) { setMsg({ ok: true, text: "MFA disabled" }); setCode(""); router.refresh(); }
    else setMsg({ ok: false, text: d.error ?? "Invalid code" });
  }

  if (enabled) {
    return (
      <div className="card p-5 space-y-3">
        <div className="text-[var(--success)] font-semibold">🔐 MFA is enabled</div>
        <form onSubmit={disable} className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="text-xs text-[var(--muted)] mb-1 block">Enter a code to disable</span>
            <input className="ci" inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn btn-ghost" disabled={loading || !code}>Disable</button>
        </form>
        {msg && <p className={`text-sm ${msg.ok ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>{msg.text}</p>}
        <Styles />
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      {!setup ? (
        <button className="btn btn-primary" onClick={startSetup} disabled={loading}>{loading ? "…" : "Set up MFA"}</button>
      ) : (
        <>
          <div>
            <p className="text-sm mb-2">1. Add this secret to your authenticator app (manual entry):</p>
            <code className="block bg-[var(--surface-2)] rounded-lg p-3 text-sm break-all font-mono">{setup.secret}</code>
            <p className="text-xs text-[var(--muted)] mt-1 break-all">Or use the otpauth URI: {setup.otpauth}</p>
          </div>
          <form onSubmit={enable} className="flex gap-2 items-end">
            <label className="flex-1">
              <span className="text-xs text-[var(--muted)] mb-1 block">2. Enter the current 6-digit code</span>
              <input className="ci" inputMode="numeric" autoFocus placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={loading || !code}>Enable</button>
          </form>
        </>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>{msg.text}</p>}
      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`.ci{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .7rem;font-size:.9rem;color:var(--foreground);outline:none}.ci:focus{border-color:var(--brand)}`}</style>;
}
