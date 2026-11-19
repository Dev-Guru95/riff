import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillingSummary } from "@/lib/entitlements";
import { BILLING_CURRENCY, planDisplay } from "@/lib/stripe";
import { PLAN_META } from "@/lib/plan-features";
import {
  PROMO,
  isPromoActive,
  listPriceCents,
  monthsFreeOnAnnual,
  annualSavingCents,
  priceView,
} from "@/lib/pricing";
import { ManageBillingButton, RestorePurchasesButton } from "./BillingClient";

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Card (web)",
  app_store: "Apple App Store",
  play_store: "Google Play",
  promo: "Promotional",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    amount / 100,
  );
}

export default async function BillingSettings({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requirePageSession();
  const status = (await searchParams).status;

  const [summary, payments] = await Promise.all([
    getBillingSummary(session.id),
    prisma.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  // planDisplay, not PLANS: a historical Premium row still has to render a
  // name, and PLANS is the sellable catalogue, which no longer contains one.
  const plan = planDisplay(summary.plan);
  const sub = summary.subscription;
  const paid = summary.plan !== "free";
  const interval = sub?.interval ?? "monthly";
  // What this plan lists at on the interval they are actually billed on. Shown
  // so "Pro" is not the only thing the page can tell them about their money.
  // Only a current Pro plan has a list price to quote. A retired Premium row
  // keeps its access but has no price card to point at any more.
  const sellable = summary.plan === "pro";
  const listCents = sellable ? listPriceCents("pro", interval) : 0;
  const promoLive = isPromoActive();
  // Checkout redirects here, but the redirect proves nothing — access only
  // exists once the verified webhook has written it. If the two disagree, say
  // so plainly instead of showing a plan the user does not actually have yet.
  const awaitingWebhook = status === "success" && summary.plan === "free";

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold">Billing</h1>

      {awaitingWebhook && (
        <div className="card p-4">
          <p className="text-sm">
            ⏳ <strong>Finishing up your payment…</strong> Stripe is still confirming it. This usually takes a few
            seconds — refresh, or use <em>Restore purchases</em> below if your plan doesn&apos;t appear.
          </p>
        </div>
      )}

      {/* The launch offer, where someone on Free is most likely to see it. */}
      {promoLive && !paid && (
        <div
          className="rounded-xl p-[1.5px]"
          style={{ background: "linear-gradient(100deg, var(--brand), var(--brand-2) 55%, var(--accent))" }}
        >
          <div className="rounded-[10px] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-bold tracking-[0.14em] uppercase px-2 py-0.5 rounded-full text-[var(--background)]"
                style={{ background: "linear-gradient(100deg, var(--brand-2), var(--brand))" }}
              >
                {PROMO.badge}
              </span>
              <strong className="text-sm">{PROMO.name}</strong>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2">
              Pro is {formatMoney(priceView("pro", "monthly").payCents, BILLING_CURRENCY)}/mo (normally{" "}
              {formatMoney(listPriceCents("pro", "monthly"), BILLING_CURRENCY)}) while the offer runs.
            </p>
            <Link href="/pricing" className="btn btn-primary mt-3 inline-flex">See the offer</Link>
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Current plan</div>
        <div className="text-2xl font-bold mt-1">{plan.name}</div>
        {summary.plan !== "premium" && (
          <p className="text-xs text-[var(--brand)] mt-0.5">{PLAN_META[summary.plan].tagline}</p>
        )}

        {sellable && listCents > 0 && (
          <div className="text-xs text-[var(--muted)] mt-2">
            {formatMoney(listCents, BILLING_CURRENCY)} per {interval === "annual" ? "year" : "month"}
            {" · billed "}
            {interval === "annual" ? "yearly" : "monthly"}
            {/* What they pay now can be less than the list price — a launch
                offer or a discount code. The exact charge is on the invoice,
                which is linked in the payment history below. */}
          </div>
        )}

        {sub?.currentPeriodEnd && paid && (
          <div className="text-xs text-[var(--muted)] mt-1">
            {sub.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </div>
        )}
        {sub?.status === "past_due" && (
          <div className="text-xs text-[var(--brand-2)] mt-1">
            Payment failed — update your card to keep your plan.
          </div>
        )}
        {sub?.provider && summary.plan !== "free" && (
          <div className="text-xs text-[var(--muted)] mt-1">
            Billed via {PROVIDER_LABELS[sub.provider] ?? sub.provider}
          </div>
        )}

        {/* Reads straight off ENTITLEMENTS, so this list cannot promise
            something the gates do not actually allow. */}
        <ul className="text-sm mt-4 space-y-1">
          <li>AI Coach messages/day: <strong>{summary.entitlements.coachMessagesPerDay >= 1000 ? "Unlimited" : summary.entitlements.coachMessagesPerDay}</strong></li>
          <li>Social accounts audited: <strong>{summary.entitlements.socialConnections}</strong></li>
          <li>Career roadmap: <strong>{summary.entitlements.roadmapHorizons.length > 1 ? "30-day to 12-month" : "30-day"}</strong></li>
          <li>Weekly missions &amp; rewards: <strong>{summary.entitlements.weeklyMissions ? "Yes" : "No"}</strong></li>
        </ul>
      </div>

      {/* A monthly subscriber is the one person who can act on this, so it is
          shown to them and nobody else. */}
      {sellable && interval === "monthly" && sub?.provider === "stripe" && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Switch to annual and save</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            {plan.name} costs{" "}
            {formatMoney(listPriceCents("pro", "annual"), BILLING_CURRENCY)} a year — that is{" "}
            {formatMoney(annualSavingCents("pro"), BILLING_CURRENCY)} less than twelve monthly
            charges, about {monthsFreeOnAnnual("pro")} months free. Stripe prorates whatever is
            left of the month you have paid for.
          </p>
          <Link href="/pricing" className="btn btn-ghost mt-3 inline-flex">Change billing period</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {summary.plan === "free" ? (
          <Link href="/pricing" className="btn btn-primary">Upgrade</Link>
        ) : (
          <ManageBillingButton />
        )}
        <Link href="/pricing" className="btn btn-ghost">View plans</Link>
        <RestorePurchasesButton />
      </div>

      {sub?.provider && sub.provider !== "stripe" && summary.plan !== "free" && (
        <p className="text-xs text-[var(--muted)]">
          This subscription was bought through {PROVIDER_LABELS[sub.provider] ?? sub.provider}, so it has to be
          cancelled or changed there.
        </p>
      )}

      {payments.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold mb-3">Payment history</h2>
          <ul className="text-sm divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">{new Date(p.createdAt).toLocaleDateString()}</span>
                <span className="flex-1">{formatMoney(p.amount, p.currency)}</span>
                <span className={p.status === "paid" ? "text-[var(--success)]" : "text-[var(--brand-2)]"}>
                  {p.status}
                </span>
                {p.invoiceUrl && (
                  <a className="text-[var(--accent)] underline" href={p.invoiceUrl} target="_blank" rel="noreferrer">
                    Receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
