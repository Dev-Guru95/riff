import { requirePageSession } from "@/lib/auth";
import { getPlan } from "@/lib/entitlements";
import { isStripeConfigured, PLANS } from "@/lib/stripe";
import { UpgradeButton } from "./PricingClient";
import Link from "next/link";

export default async function PricingPage() {
  const session = await requirePageSession();
  const currentPlan = await getPlan(session.id);
  const configured = isStripeConfigured();

  const order: ("free" | "pro" | "premium")[] = ["free", "pro", "premium"];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Plans</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Upgrade to unlock all courses, unlimited coaching, and full audits.</p>

      {/* Setup details (which Stripe env vars are missing) belong in the server
          log, not in front of artists. */}
      {!configured && (
        <div className="card p-4 mb-6">
          <p className="text-sm">
            💳 <strong>Upgrades are opening soon.</strong> Paid plans aren&apos;t available to purchase just yet —
            keep learning on Free and we&apos;ll let you know the moment they go live.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {order.map((key) => {
          const p = PLANS[key];
          const isCurrent = currentPlan === key;
          const highlight = key === "pro";
          return (
            <div key={key} className={`card p-6 flex flex-col ${highlight ? "border-[var(--brand)]" : ""}`}>
              {highlight && <div className="text-xs text-[var(--brand)] font-semibold mb-1">MOST POPULAR</div>}
              <h2 className="text-lg font-bold">{p.name}</h2>
              <div className="text-3xl font-extrabold my-2">
                ${p.priceMonthly}
                <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
              </div>
              <ul className="space-y-1.5 text-sm my-4 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-[var(--success)]">✓</span>{f}</li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="btn btn-ghost w-full pointer-events-none opacity-70">Current plan</span>
              ) : key === "free" ? (
                <span className="btn btn-ghost w-full pointer-events-none opacity-50">Free</span>
              ) : (
                <UpgradeButton plan={key} disabled={!configured} />
              )}
            </div>
          );
        })}
      </div>

      {/* Price, billing period and cancellation route have to be visible where
          plans are sold, with Terms and Privacy linked (App Store 3.1.2, and
          Google Play's subscriptions policy). */}
      <p className="text-xs text-[var(--muted)] text-center mt-6 max-w-xl mx-auto">
        Paid plans are billed monthly in US dollars and renew automatically until you cancel.
        Cancel any time from Settings → Billing; you keep your plan until the end of the month you
        have paid for. See our{" "}
        <Link href="/terms" className="text-[var(--accent)] underline">Terms of Use</Link> and{" "}
        <Link href="/privacy" className="text-[var(--accent)] underline">Privacy Policy</Link>.
      </p>
    </main>
  );
}
