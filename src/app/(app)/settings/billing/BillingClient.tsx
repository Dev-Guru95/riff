"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Re-reads the subscription from Stripe (and RevenueCat) and rewrites our
 * record. This is the fix-it button when someone paid on another device, or
 * came back from Checkout before the webhook landed.
 */
export function RestorePurchasesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function restore() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/restore", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error ?? "Could not restore purchases");
        return;
      }
      setMsg(d.restored ? "Subscription restored." : "No previous purchase found for this account.");
      if (d.restored) router.refresh();
    } catch {
      setMsg("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button className="btn btn-ghost" onClick={restore} disabled={loading}>
        {loading ? "Checking…" : "Restore purchases"}
      </button>
      {msg && <span className="text-xs text-[var(--muted)] ml-2">{msg}</span>}
    </span>
  );
}
