"use client";

import { useState } from "react";

export function UpgradeButton({ plan, disabled }: { plan: "pro" | "premium"; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const d = await res.json();
    if (res.ok && d.url) {
      window.location.href = d.url; // redirect to Stripe Checkout
    } else {
      setErr(d.error ?? "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary w-full" onClick={upgrade} disabled={loading || disabled}>
        {loading ? "Redirecting…" : disabled ? "Unavailable" : `Upgrade to ${plan}`}
      </button>
      {err && <p className="text-xs text-[var(--brand-2)] mt-1">{err}</p>}
    </div>
  );
}
