"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UpgradeButton({
  plan,
  disabled,
  label,
}: {
  plan: "pro" | "premium";
  disabled?: boolean;
  /** "Upgrade to pro", "Switch to premium", … decided by the server. */
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();

      if (res.ok && d.url) {
        window.location.href = d.url; // redirect to Stripe Checkout
        return;
      }
      if (res.ok && d.changed) {
        // An existing subscription was moved to the new price in place — no
        // Checkout needed, and the server has already synced the new state.
        router.push("/settings/billing");
        router.refresh();
        return;
      }
      setErr(d.error ?? "Could not start checkout");
      setLoading(false);
    } catch {
      setErr("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary w-full" onClick={upgrade} disabled={loading || disabled}>
        {loading ? "Working…" : disabled ? "Coming soon" : label}
      </button>
      {err && <p className="text-xs text-[var(--brand-2)] mt-1">{err}</p>}
    </div>
  );
}
