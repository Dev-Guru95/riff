import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getBillingSummary } from "@/lib/entitlements";
import { isStripeConfigured, BILLING_CURRENCY, PLANS, type PlanKey } from "@/lib/stripe";
import { planPriceCents } from "@/lib/coupons";
import type { BillingResponse } from "@/lib/mobile/types";

const ORDER: PlanKey[] = ["free", "pro", "premium"];

// GET /api/mobile/billing — src/app/(app)/pricing/page.tsx +
// settings/billing/page.tsx. Stripe price ids and customer/subscription ids are
// not returned.
//
// Paid plans are still bought on the website (App Store 3.1.1 / Play Payments):
// POST /api/billing/checkout refuses the native client. What the app *can* do
// is apply a discount code and, when one covers the whole price, activate the
// plan through POST /api/billing/redeem — no payment, so no purchasing
// mechanism. Prices are returned so the checkout summary can show what the
// code took off. Restoring access is POST /api/billing/restore.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const summary = await getBillingSummary(session.id);
  const sub = summary.subscription;

  const body: BillingResponse = {
    plans: ORDER.map((key) => ({
      key,
      name: PLANS[key].name,
      priceMonthly: PLANS[key].priceMonthly,
      priceCents: planPriceCents(key),
      features: PLANS[key].features,
    })),
    // getPlan() and getBillingSummary().plan are the same rule.
    currentPlan: summary.plan,
    billingConfigured: isStripeConfigured(),
    currency: BILLING_CURRENCY,
    discountsEnabled: true,
    entitlements: { plan: summary.plan, ...summary.entitlements },
    subscription: sub
      ? {
          plan: summary.plan,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          provider: sub.provider,
          entitlementIds: sub.entitlementIds,
        }
      : null,
    canRestore: true,
  };
  return ok(body);
});
