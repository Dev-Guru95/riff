"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { BillingInterval, PriceView } from "@/lib/pricing";
import type { FeatureGroup, FeatureValue, PlanKeyLike } from "@/lib/plan-features";
import { UpgradeButton } from "./PricingClient";

export type PlanCard = {
  key: PlanKeyLike;
  name: string;
  tagline: string;
  audience: string;
  highlights: string[];
  /** Both intervals, priced on the server. null for Free. */
  prices: Record<BillingInterval, PriceView> | null;
  /** Intervals this deployment has a Stripe price for. */
  sellable: BillingInterval[];
};

export type PromoView = {
  active: boolean;
  name: string;
  badge: string;
  tagline: string;
  /** Localised on the server to keep server and client markup identical. */
  endsAtLabel: string;
  daysLeft: number;
};

const CHECK = <span className="text-[var(--success)]">✓</span>;
const DASH = <span className="text-[var(--muted)] opacity-50">—</span>;

function cell(v: FeatureValue) {
  if (v === true) return CHECK;
  if (v === false) return DASH;
  return <span className="text-[11px] leading-tight">{v}</span>;
}

export function PlansClient({
  plans,
  groups,
  promo,
  currentPlan,
  currency,
  configured,
  premiumDifference,
}: {
  plans: PlanCard[];
  groups: FeatureGroup[];
  promo: PromoView;
  currentPlan: PlanKeyLike;
  currency: string;
  /** False when Stripe has no keys — the cards still render, nothing can be bought. */
  configured: boolean;
  premiumDifference: string;
}) {
  // Annual by default while the launch offer is on: it is the better deal and
  // the one the campaign is built around.
  const [interval, setInterval] = useState<BillingInterval>(promo.active ? "annual" : "monthly");
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* ---- Campaign banner ------------------------------------------------
          Deliberately not a flat strip of colour: a gradient hairline frame
          and real typography, so a 50%-off launch reads as an event rather
          than a coupon pop-up. */}
      {promo.active && (
        <div
          className="rounded-xl p-[1.5px] mb-6"
          style={{ background: "linear-gradient(100deg, var(--brand), var(--brand-2) 55%, var(--accent))" }}
        >
          <div className="rounded-[10px] bg-[var(--surface)] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className="text-[11px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full text-[var(--background)]"
                style={{ background: "linear-gradient(100deg, var(--brand-2), var(--brand))" }}
              >
                {promo.badge}
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold">{promo.name}</h2>
              <span className="text-xs text-[var(--muted)] sm:ml-auto">
                Ends {promo.endsAtLabel}
                {promo.daysLeft > 0 && ` · ${promo.daysLeft} day${promo.daysLeft === 1 ? "" : "s"} left`}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">{promo.tagline}</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Plans</h1>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
          Free gets you through every track and certificate. Pro turns Riff into the toolkit you run your
          music business from. Premium adds the strategy on top.
        </p>
      </div>

      {!configured && (
        <div className="card p-4 mb-6">
          <p className="text-sm">
            💳 <strong>Upgrades are opening soon.</strong> Paid plans aren&apos;t available to purchase just yet —
            keep learning on Free and we&apos;ll let you know the moment they go live.
          </p>
        </div>
      )}

      {/* ---- Interval toggle ---- */}
      <div className="flex justify-center mb-6">
        <div
          role="tablist"
          aria-label="Billing period"
          className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]"
        >
          {(["monthly", "annual"] as BillingInterval[]).map((i) => {
            const on = interval === i;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={on}
                onClick={() => setInterval(i)}
                className={`text-sm px-4 py-1.5 rounded-full transition ${
                  on ? "bg-[var(--brand)] text-white font-semibold" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {i === "monthly" ? "Monthly" : "Annual"}
                {i === "annual" && (
                  <span className={`ml-1.5 text-[10px] font-bold ${on ? "text-white/90" : "text-[var(--success)]"}`}>
                    2 MONTHS FREE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Plan cards ---- */}
      <div className="grid gap-4 md:grid-cols-3 items-start">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.key;
          const featured = p.key === "pro";
          const price = p.prices?.[interval] ?? null;
          const buyable = p.key !== "free" && configured && p.sellable.includes(interval);

          return (
            <div
              key={p.key}
              className={`card p-6 flex flex-col h-full relative ${
                featured ? "border-[var(--brand)] md:-mt-2 md:pb-8" : ""
              }`}
            >
              {featured && (
                <div className="absolute -top-2.5 left-6 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[var(--brand)] text-white">
                  Most popular
                </div>
              )}

              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="text-xs text-[var(--brand)] font-medium mt-0.5">{p.tagline}</p>

              {/* Price block. Fixed-height-ish so the three cards line up. */}
              <div className="my-4 min-h-[112px]">
                {price === null ? (
                  <>
                    <div className="text-4xl font-extrabold">{money(0)}</div>
                    <p className="text-xs text-[var(--muted)] mt-1">Free forever. No card needed.</p>
                  </>
                ) : (
                  <>
                    {price.promo && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-[var(--muted)] line-through">{money(price.listCents)}</span>
                        <span
                          className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-[var(--background)]"
                          style={{ background: "linear-gradient(100deg, var(--brand-2), var(--brand))" }}
                        >
                          {price.percentOff}% off
                        </span>
                      </div>
                    )}
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{money(price.payCents)}</span>
                      <span className="text-sm font-normal text-[var(--muted)] mb-1">
                        {interval === "annual" ? "/yr" : "/mo"}
                      </span>
                    </div>
                    {interval === "annual" ? (
                      <p className="text-xs text-[var(--success)] mt-1">
                        {money(price.perMonthCents)}/mo · save {money(price.annualSavingCents)} a year
                        {price.monthsFree > 0 && ` (${price.monthsFree} months free)`}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--muted)] mt-1">Billed monthly. Cancel any time.</p>
                    )}
                    {price.promo && price.thenCents !== null && (
                      <p className="text-[11px] text-[var(--muted)] mt-1">
                        {promo.name} price for {price.holdsFor}, then {money(price.thenCents)}
                        {interval === "annual" ? "/yr" : "/mo"}.
                      </p>
                    )}
                  </>
                )}
              </div>

              <p className="text-xs text-[var(--muted)] mb-3">{p.audience}</p>

              <ul className="space-y-2 text-sm flex-1 mb-5">
                {p.highlights.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[var(--success)] shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="btn btn-ghost w-full pointer-events-none opacity-70">Current plan</span>
              ) : p.key === "free" ? (
                // Downgrading to Free means cancelling, which happens in the
                // Stripe customer portal so the cancellation terms are shown.
                currentPlan === "free" ? (
                  <span className="btn btn-ghost w-full pointer-events-none opacity-50">Free</span>
                ) : (
                  <Link href="/settings/billing" className="btn btn-ghost w-full">Manage plan</Link>
                )
              ) : (
                <UpgradeButton
                  plan={p.key as "pro" | "premium"}
                  interval={interval}
                  disabled={!buyable}
                  variant={featured ? "primary" : "ghost"}
                  label={
                    currentPlan === "free"
                      ? `Get ${p.name}`
                      : currentPlan === "premium" && p.key === "pro"
                        ? "Switch to Pro"
                        : `Upgrade to ${p.name}`
                  }
                />
              )}

              {p.key !== "free" && configured && !p.sellable.includes(interval) && (
                <p className="text-[11px] text-[var(--muted)] mt-2">
                  {interval === "annual" ? "Annual" : "Monthly"} billing isn&apos;t set up for {p.name} yet.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Why Premium ---- */}
      <div className="card p-5 mt-6 border-[var(--accent)]/40">
        <h2 className="text-sm font-semibold mb-1">Pro or Premium?</h2>
        <p className="text-sm text-[var(--muted)]">{premiumDifference}</p>
      </div>

      {/* ---- Full comparison ------------------------------------------------
          Scrolls sideways on a narrow screen rather than squeezing four
          columns into 320px; the cards above already carry the headline
          differences, so nothing is hidden from a phone. */}
      <h2 className="text-lg font-bold mt-10 mb-3">Compare every feature</h2>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left font-semibold p-3 w-[46%]">Feature</th>
              <th className="font-semibold p-3 text-center w-[18%]">Free</th>
              <th className="font-semibold p-3 text-center w-[18%] text-[var(--brand)]">Pro</th>
              <th className="font-semibold p-3 text-center w-[18%]">Premium</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.title}>
                <tr className="bg-[var(--surface-2)]">
                  <th colSpan={4} className="text-left text-xs font-semibold uppercase tracking-wide p-2.5 px-3 text-[var(--muted)]">
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={`${g.title}-${r.label}`} className="border-b border-[var(--border)] last:border-0 align-top">
                    <td className="p-3">
                      <div>{r.label}</div>
                      {r.hint && <p className="text-[11px] text-[var(--muted)] mt-0.5">{r.hint}</p>}
                    </td>
                    <td className="p-3 text-center">{cell(r.free)}</td>
                    <td className="p-3 text-center">{cell(r.pro)}</td>
                    <td className="p-3 text-center">{cell(r.premium)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Price, billing period and cancellation route have to be visible where
          plans are sold, with Terms and Privacy linked (App Store 3.1.2, and
          Google Play's subscriptions policy). */}
      <p className="text-xs text-[var(--muted)] text-center mt-8 max-w-2xl mx-auto">
        Paid plans are billed in US dollars — {interval === "annual" ? "once a year" : "every month"} — and renew
        automatically until you cancel. Cancel any time from Settings → Billing; you keep your plan until the end of
        the period you have paid for.
        {promo.active && ` ${promo.name} pricing applies to new subscriptions started before the offer ends.`}{" "}
        See our <Link href="/terms" className="text-[var(--accent)] underline">Terms of Use</Link> and{" "}
        <Link href="/privacy" className="text-[var(--accent)] underline">Privacy Policy</Link>.
      </p>
    </main>
  );
}
