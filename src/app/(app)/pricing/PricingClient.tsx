"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import type { BillingInterval } from "@/lib/pricing";

/** The server's priced quote for a code. Never recomputed here. */
type DiscountQuote = {
  code: string;
  description: string;
  currency: string;
  originalCents: number;
  discountCents: number;
  finalCents: number;
  free: boolean;
  durationMonths: number;
};

/** The launch offer, as the server priced it for this plan + interval. */
type CampaignDiscount = {
  campaign: string;
  name: string;
  discountCents: number;
  finalCents: number;
  originalCents: number;
  percentOff: number;
  holdsFor: string;
};

export function UpgradeButton({
  plan,
  interval,
  disabled,
  label,
  variant = "primary",
}: {
  plan: "pro";
  interval: BillingInterval;
  disabled?: boolean;
  /** "Get Pro", "Upgrade to Pro", … decided by the server. */
  label: string;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Discount code. Collapsed until asked for, so the common path stays one tap.
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [campaign, setCampaign] = useState<CampaignDiscount | null>(null);
  const [campaignWins, setCampaignWins] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  function clearQuote() {
    setQuote(null);
    setCampaign(null);
    setCampaignWins(false);
    setCodeErr(null);
  }

  async function applyCode() {
    const value = code.trim();
    if (!value || applying) return;
    setApplying(true);
    setCodeErr(null);
    try {
      const res = await fetch("/api/billing/discount", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval, code: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.discount) {
        setQuote(d.discount as DiscountQuote);
        setCampaign((d.campaign as CampaignDiscount) ?? null);
        setCampaignWins(!!d.campaignWins);
      } else {
        clearQuote();
        setCodeErr(d.error ?? "That code couldn't be applied.");
      }
    } catch {
      setCodeErr("Could not reach the server. Try again.");
    } finally {
      setApplying(false);
    }
  }

  /** A code that covers the whole price: activate, don't charge. */
  async function activateFree() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval, code: quote?.code ?? code.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.activated) {
        router.push("/settings/billing?status=activated");
        router.refresh();
        return;
      }
      setErr(d.error ?? "Could not activate your plan.");
      setLoading(false);
    } catch {
      setErr("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  async function upgrade() {
    // The server refuses a zero-total Checkout session, so a full discount
    // takes the activation path instead of Stripe.
    if (quote?.free) return activateFree();

    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The code, not the amount: the server prices it again — and decides
        // whether the code or the launch offer is the better deal.
        body: JSON.stringify({ plan, interval, ...(quote ? { code: quote.code } : {}) }),
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

  const money = (cents: number) => formatMoney(cents, quote?.currency ?? "usd");
  /** What the artist will actually be charged, given which discount wins. */
  const effective = campaignWins && campaign ? campaign : quote;

  return (
    <div>
      {quote && effective && (
        <dl className="text-xs mb-3 space-y-1" aria-live="polite">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">{interval === "annual" ? "Plan (1 year)" : "Plan"}</dt>
            <dd>{money(quote.originalCents)}</dd>
          </div>
          <div className="flex justify-between text-[var(--success)]">
            <dt>{campaignWins && campaign ? campaign.name : `Discount (${quote.code})`}</dt>
            <dd>−{money(effective.discountCents)}</dd>
          </div>
          <div className="flex justify-between font-semibold border-t border-[var(--border)] pt-1">
            <dt>Total today</dt>
            <dd>{money(effective.finalCents)}</dd>
          </div>
          {campaignWins && campaign ? (
            // Say it plainly rather than letting the code look broken: the
            // offer saved them more, so the offer is what was applied.
            <p className="text-[var(--accent)]">
              ✓ The {campaign.name} already saves you more than code {quote.code}, so we&apos;ve applied the offer —
              you keep {money(campaign.discountCents)} off.
            </p>
          ) : (
            <p className="text-[var(--success)]">
              ✓ Code applied{quote.description ? ` — ${quote.description}` : ""}.
              {quote.free
                ? ` Your ${quote.durationMonths > 0 ? `${quote.durationMonths} month${quote.durationMonths === 1 ? "" : "s"} of ` : ""}access is free.`
                : ""}
            </p>
          )}
        </dl>
      )}

      <button
        className={`btn w-full ${variant === "primary" ? "btn-primary" : "btn-ghost"}`}
        onClick={upgrade}
        disabled={loading || (disabled && !quote?.free)}
      >
        {loading ? "Working…" : quote?.free ? "Activate for free" : disabled ? "Coming soon" : label}
      </button>
      {err && <p className="text-xs text-[var(--brand-2)] mt-1">{err}</p>}

      {showCode ? (
        <div className="mt-2">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`code-${plan}-${interval}`}>Discount code</label>
            <input
              id={`code-${plan}-${interval}`}
              className="input flex-1 text-sm min-w-0"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                clearQuote();
              }}
              onKeyDown={(e) => e.key === "Enter" && applyCode()}
              placeholder="Discount code"
              autoComplete="off"
              maxLength={64}
            />
            <button
              type="button"
              className="btn btn-ghost text-sm px-3 shrink-0"
              onClick={applyCode}
              disabled={applying || !code.trim()}
            >
              {applying ? "Checking…" : "Apply"}
            </button>
          </div>
          {codeErr && <p className="text-xs text-[var(--brand-2)] mt-1">{codeErr}</p>}
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-[var(--muted)] hover:text-[var(--accent)] mt-2"
          onClick={() => setShowCode(true)}
        >
          Have a discount code?
        </button>
      )}
    </div>
  );
}
