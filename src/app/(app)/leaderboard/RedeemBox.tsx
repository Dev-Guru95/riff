"use client";

import { useState } from "react";

export function RedeemBox() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/coupons/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) setMsg({ ok: true, text: `Redeemed ${d.code} — ${d.type === "percent" ? `${d.value}% off` : d.description || "reward applied"}!` });
    else setMsg({ ok: false, text: d.error ?? "Could not redeem" });
    if (res.ok) setCode("");
  }

  return (
    <form onSubmit={redeem} className="card p-4 mt-6">
      <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Have a reward code?</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          placeholder="e.g. TOP1000"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button className="btn btn-primary px-5" disabled={loading || !code}>Redeem</button>
      </div>
      {msg && <p className={`text-sm mt-2 ${msg.ok ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>{msg.text}</p>}
    </form>
  );
}
