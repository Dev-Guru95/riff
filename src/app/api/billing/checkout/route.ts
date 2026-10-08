import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stripe, isStripeConfigured, PLANS, APP_URL } from "@/lib/stripe";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ plan: z.enum(["pro", "premium"]) });

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  if (!isStripeConfigured() || !stripe) {
    console.warn("billing/checkout: Stripe is not configured — set STRIPE_SECRET_KEY and price IDs.");
    return fail("Upgrades aren't available yet.", 503);
  }
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const priceId = PLANS[body.data.plan].priceId;
  if (!priceId) return fail(`No Stripe price configured for the ${body.data.plan} plan`, 503);

  // Reuse the existing Stripe customer if we have one.
  const sub = await prisma.subscription.findUnique({ where: { userId: session.id } });
  let customerId = sub?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: session.email, metadata: { userId: session.id } });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId: session.id },
      create: { userId: session.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?status=success`,
    cancel_url: `${APP_URL}/pricing?status=cancelled`,
    client_reference_id: session.id,
    metadata: { userId: session.id, plan: body.data.plan },
  });

  return ok({ url: checkout.url });
});
