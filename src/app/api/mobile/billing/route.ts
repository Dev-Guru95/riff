import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getEntitlements } from "@/lib/entitlements";
import { isStripeConfigured, PLANS, type PlanKey } from "@/lib/stripe";
import type { BillingResponse } from "@/lib/mobile/types";

const ORDER: PlanKey[] = ["free", "pro", "premium"];

// GET /api/mobile/billing — src/app/(app)/pricing/page.tsx +
// settings/billing/page.tsx. Stripe price ids and customer/subscription ids are
// not returned. Upgrade: POST /api/billing/checkout; manage: POST /api/billing/portal.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [ent, sub] = await Promise.all([
    getEntitlements(session.id),
    prisma.subscription.findUnique({
      where: { userId: session.id },
      select: { plan: true, status: true, currentPeriodEnd: true },
    }),
  ]);

  const body: BillingResponse = {
    plans: ORDER.map((key) => ({
      key,
      name: PLANS[key].name,
      priceMonthly: PLANS[key].priceMonthly,
      features: PLANS[key].features,
    })),
    // getPlan() and getEntitlements().plan are the same rule.
    currentPlan: ent.plan,
    billingConfigured: isStripeConfigured(),
    entitlements: ent,
    subscription: sub
      ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null }
      : null,
  };
  return ok(body);
});
