import { prisma } from "@/lib/prisma";
import { getSession, isNativeClient } from "@/lib/auth";
import { stripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { ok, fail, withRoute } from "@/lib/api";

// Stripe Customer Portal — manage/cancel subscription + payment method.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  // Defence in depth. The app ships no purchase UI (App Store 3.1.1 / Play
  // Payments: paid plans are sold on the website, and the app may not even
  // link to a purchasing mechanism). Refusing the native client here means a
  // stray link, a deep link or an older build cannot open one either.
  if (isNativeClient(req)) {
    return fail("Plans are managed on the Riff website.", 403, { reason: "not_available_in_app" });
  }
  if (!isStripeConfigured() || !stripe) return fail("Billing is not configured.", 503);

  const sub = await prisma.subscription.findUnique({ where: { userId: session.id } });
  if (!sub?.stripeCustomerId) return fail("No billing account yet — subscribe first.", 400);

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL}/settings/billing`,
  });
  return ok({ url: portal.url });
});
