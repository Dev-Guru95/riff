"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function manage() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const d = await res.json();
    if (res.ok && d.url) window.location.href = d.url;
    else { setErr(d.error ?? "Could not open billing portal"); setLoading(false); }
  }

  return (
    <span>
      <button className="btn btn-primary" onClick={manage} disabled={loading}>
        {loading ? "Opening…" : "Manage subscription"}
      </button>
      {err && <span className="text-xs text-[var(--brand-2)] ml-2">{err}</span>}
    </span>
  );
}
