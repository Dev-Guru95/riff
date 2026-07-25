import { getSession } from "@/lib/auth";
import { getPlan } from "@/lib/entitlements";
import { isStripeConfigured, PLANS } from "@/lib/stripe";
import { UpgradeButton } from "./PricingClient";

export default async function PricingPage() {
  const session = (await getSession())!;
  const currentPlan = await getPlan(session.id);
  const configured = isStripeConfigured();

  const order: ("free" | "pro" | "premium")[] = ["free", "pro", "premium"];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Plans</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Upgrade to unlock all courses, unlimited coaching, and full audits.</p>

      {!configured && (
        <div className="card p-4 mb-6 border-[var(--warning)]">
          <p className="text-sm">
            💳 <strong>Billing isn&apos;t configured yet.</strong> Set <code>STRIPE_SECRET_KEY</code>,
            <code> STRIPE_PRICE_PRO</code>, <code>STRIPE_PRICE_PREMIUM</code>, and <code>STRIPE_WEBHOOK_SECRET</code> in
            your environment to enable checkout. The flow below is fully wired and will work once keys are added.
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
    </main>
  );
}
