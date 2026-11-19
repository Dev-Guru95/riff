import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getBillingSummary } from "@/lib/entitlements";
import { isStripeConfigured, BILLING_CURRENCY, PLANS, type PlanKey } from "@/lib/stripe";
import { planPriceCents } from "@/lib/coupons";
import { PROMO, isPromoActive, planPrices, type PaidPlanKey } from "@/lib/pricing";
import type { BillingResponse, PlanIntervalPrice } from "@/lib/mobile/types";

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

  const now = new Date();
  const promoLive = isPromoActive(now);

  const body: BillingResponse = {
    plans: ORDER.map((key) => ({
      key,
      name: PLANS[key].name,
      priceMonthly: PLANS[key].priceMonthly,
      priceCents: planPriceCents(key),
      features: PLANS[key].features,
      // Both intervals, priced on the server exactly as the website prices
      // them, so the app can never show a figure the web checkout would not
      // honour. The app still sells nothing — this is display only.
      ...(key === "free" ? {} : { prices: intervalPrices(key as PaidPlanKey, now) }),
    })),
    // getPlan() and getBillingSummary().plan are the same rule.
    currentPlan: summary.plan,
    billingConfigured: isStripeConfigured(),
    currency: BILLING_CURRENCY,
    discountsEnabled: true,
    promo: promoLive
      ? { id: PROMO.id, name: PROMO.name, badge: PROMO.badge, percentOff: PROMO.percentOff, endsAt: PROMO.endsAt }
      : null,
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

/** Both billing intervals for a paid plan, in the shape the app renders. */
function intervalPrices(
  plan: PaidPlanKey,
  now: Date,
): { monthly: PlanIntervalPrice; annual: PlanIntervalPrice } {
  const views = planPrices(plan, now);
  const toPrice = (v: (typeof views)["monthly"]): PlanIntervalPrice => ({
    listCents: v.listCents,
    payCents: v.payCents,
    promo: v.promo,
    perMonthCents: v.perMonthCents,
    annualSavingCents: v.annualSavingCents,
  });
  return { monthly: toPrice(views.monthly), annual: toPrice(views.annual) };
}
