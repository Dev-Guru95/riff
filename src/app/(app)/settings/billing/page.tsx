import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillingSummary } from "@/lib/entitlements";
import { PLANS } from "@/lib/stripe";
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

  const plan = PLANS[summary.plan];
  const sub = summary.subscription;
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

      <div className="card p-6">
        <div className="text-xs text-[var(--muted)] uppercase tracking-wide">Current plan</div>
        <div className="text-2xl font-bold mt-1">{plan.name}</div>

        {sub?.currentPeriodEnd && summary.plan !== "free" && (
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

        <ul className="text-sm mt-4 space-y-1">
          <li>Coach messages/day: <strong>{summary.entitlements.coachMessagesPerDay >= 1000 ? "Unlimited" : summary.entitlements.coachMessagesPerDay}</strong></li>
          <li>Social connections: <strong>{summary.entitlements.socialConnections}</strong></li>
          <li>All courses: <strong>{summary.entitlements.allCourses ? "Yes" : "No"}</strong></li>
          <li>Human-reviewed assignments: <strong>{summary.entitlements.humanReview ? "Yes" : "No"}</strong></li>
        </ul>
      </div>

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
