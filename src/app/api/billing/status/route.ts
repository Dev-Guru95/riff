import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getBillingSummary } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { isRevenueCatConfigured } from "@/lib/revenuecat";
import { ok, fail, withRoute } from "@/lib/api";

/**
 * Current billing state, resolved on the server from our own records.
 *
 * The client is never the authority here: this reads what the verified Stripe
 * and RevenueCat webhooks wrote, which is why the post-checkout success page
 * can safely poll it instead of believing the redirect.
 */
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [summary, payments] = await Promise.all([
    getBillingSummary(session.id),
    prisma.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        invoiceUrl: true,
        createdAt: true,
      },
    }),
  ]);

  return ok({
    ...summary,
    // Flattened for the existing callers that read `ent.plan` and the booleans.
    ...summary.entitlements,
    payments,
    billingConfigured: isStripeConfigured(),
    revenueCatConfigured: isRevenueCatConfigured(),
  });
});
