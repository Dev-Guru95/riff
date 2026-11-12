import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getBillingSummary } from "@/lib/entitlements";
import { isStripeConfigured, PLANS, type PlanKey } from "@/lib/stripe";
import type { BillingResponse } from "@/lib/mobile/types";

const ORDER: PlanKey[] = ["free", "pro", "premium"];

// GET /api/mobile/billing — src/app/(app)/pricing/page.tsx +
// settings/billing/page.tsx. Stripe price ids and customer/subscription ids are
// not returned. The app sells nothing: there is no upgrade path here by design
// (App Store 3.1.1 / Play Payments). Restoring access is POST /api/billing/restore.
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
      features: PLANS[key].features,
    })),
    // getPlan() and getBillingSummary().plan are the same rule.
    currentPlan: summary.plan,
    billingConfigured: isStripeConfigured(),
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
