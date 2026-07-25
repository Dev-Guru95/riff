import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { ok, fail, withRoute } from "@/lib/api";

// Stripe Customer Portal — manage/cancel subscription + payment method.
export const POST = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  if (!isStripeConfigured() || !stripe) return fail("Billing is not configured.", 503);

  const sub = await prisma.subscription.findUnique({ where: { userId: session.id } });
  if (!sub?.stripeCustomerId) return fail("No billing account yet — subscribe first.", 400);

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL}/settings/billing`,
  });
  return ok({ url: portal.url });
});
