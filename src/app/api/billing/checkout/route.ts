import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isNativeClient } from "@/lib/auth";
import { stripe, isStripeConfigured, PLANS, APP_URL, statusGrantsAccess, priceIdFor } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/subscriptions";
import { quoteCoupon, ensureStripeCoupon, campaignDiscount, ensureCampaignCoupon } from "@/lib/coupons";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

// `code` is optional: an empty checkout is the normal path, and the discount
// is re-validated here rather than trusted from whatever the client quoted.
// `interval` defaults to monthly so an older client — or the app — keeps
// working unchanged.
const schema = z.object({
  plan: z.enum(["pro", "premium"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
  code: z.string().min(1).max(64).optional(),
});

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
  if (!isStripeConfigured() || !stripe) {
    console.warn("billing/checkout: Stripe is not configured — set STRIPE_SECRET_KEY and price IDs.");
    return fail("Upgrades aren't available yet.", 503);
  }
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const plan = body.data.plan;
  const interval = body.data.interval;
  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    console.warn(
      `billing/checkout: no Stripe price configured for ${plan}/${interval} — set STRIPE_PRICE_${plan.toUpperCase()}${interval === "annual" ? "_ANNUAL" : ""}.`,
    );
    return fail(
      interval === "annual"
        ? "Annual billing isn't available yet — choose monthly."
        : `No Stripe price configured for the ${plan} plan`,
      503,
    );
  }

  // ---- Discounts -----------------------------------------------------------
  // Two things can take money off: a discount code the artist typed, and the
  // BFCM launch offer, which applies automatically for its window. Both are
  // priced here from our own prices, never from the request.
  //
  // They do not stack — a 50%-off campaign plus a 50%-off code would hand a
  // plan away for nothing — so whichever is worth *more to the artist* wins.
  // Both are measured from the same list price, which is what makes them
  // comparable (see `planPriceCents`).
  //
  // A code that covers the whole price is not a Stripe purchase at all —
  // Checkout refuses a zero total — so it is sent to /api/billing/redeem,
  // which activates the plan and records the redemption.
  const campaign = campaignDiscount(plan, interval);
  let stripeCouponId: string | null = null;
  let appliedCampaign = false;

  if (body.data.code) {
    const quoted = await quoteCoupon(session.id, body.data.code, plan, interval);
    if (!quoted.ok) return fail(quoted.message, quoted.status, { reason: quoted.reason });
    if (quoted.quote.free) {
      return fail("That code covers the full price — activate the plan instead of paying.", 409, {
        reason: "free_activation",
        discount: quoted.quote,
      });
    }
    if (campaign && campaign.discountCents > quoted.quote.discountCents) {
      stripeCouponId = await ensureCampaignCoupon(plan, interval);
      appliedCampaign = !!stripeCouponId;
    }
    if (!appliedCampaign) stripeCouponId = await ensureStripeCoupon(quoted.quote);
  } else if (campaign) {
    stripeCouponId = await ensureCampaignCoupon(plan, interval);
    appliedCampaign = !!stripeCouponId;
  }

  const existing = await prisma.subscription.findUnique({ where: { userId: session.id } });

  // ---- Already subscribed: change the plan in place ------------------------
  // Sending an existing subscriber back through Checkout would open a *second*
  // subscription and bill them twice, so an upgrade or downgrade edits the
  // live subscription instead. Stripe prorates the difference.
  if (existing?.stripeSubscriptionId && statusGrantsAccess(existing.status)) {
    const current = await stripe.subscriptions.retrieve(existing.stripeSubscriptionId);
    const item = current.items.data[0];

    // A subscription with no items cannot be re-priced, and one that no longer
    // entitles should start fresh — both fall through to Checkout.
    if (statusGrantsAccess(current.status) && item) {
      // Same plan *and* same interval. Moving Pro monthly → Pro annual is a
      // real change, so it falls through to the update below.
      if (item.price?.id === priceId && !current.cancel_at_period_end) {
        return fail(
          `You're already on the ${PLANS[plan].name} plan, billed ${interval === "annual" ? "yearly" : "monthly"}.`,
          409,
        );
      }
      const updated = await stripe.subscriptions.update(current.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        // Switching plan also un-cancels a subscription that was set to lapse.
        cancel_at_period_end: false,
        // An existing subscriber applying a code gets it on the subscription
        // itself — there is no Checkout session to carry it.
        ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
        metadata: { userId: session.id, plan, interval, ...(appliedCampaign ? { campaign: campaign!.campaign } : {}) },
      });
      await syncStripeSubscription(updated, session.id);
      return ok({ changed: true, plan, interval, url: null, campaignApplied: appliedCampaign });
    }
  }

  // ---- New subscription: Stripe Checkout -----------------------------------
  const customerId = await ensureCustomer(session.id, session.email, existing?.stripeCustomerId ?? null);

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?status=success`,
    cancel_url: `${APP_URL}/pricing?status=cancelled`,
    client_reference_id: session.id,
    // Stripe refuses both at once: an applied coupon replaces the promo-code
    // box, which is right — the code has already been validated against our
    // own Coupon table and priced.
    ...(stripeCouponId
      ? { discounts: [{ coupon: stripeCouponId }] }
      : { allow_promotion_codes: true }),
    metadata: {
      userId: session.id,
      plan,
      interval,
      ...(body.data.code ? { riffCode: body.data.code.toUpperCase() } : {}),
      ...(appliedCampaign ? { campaign: campaign!.campaign } : {}),
    },
    // Stamped on the subscription itself so every later webhook — renewal,
    // cancellation, a change made from the Stripe dashboard — can map back to
    // this user without depending on our own customer lookup.
    subscription_data: {
      metadata: { userId: session.id, plan, interval, ...(appliedCampaign ? { campaign: campaign!.campaign } : {}) },
    },
  });

  return ok({ url: checkout.url, changed: false, campaignApplied: appliedCampaign });
});

/**
 * Get this user's Stripe customer, creating one only if they truly have none.
 *
 * Checks our row first, then Stripe itself: if the local row was lost, finding
 * the existing customer by its `userId` metadata avoids stranding a second
 * customer record (and a second payment method) in the account.
 */
async function ensureCustomer(userId: string, email: string, known: string | null): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  if (known) return known;

  let customerId: string | null = null;
  try {
    const found = await stripe.customers.search({
      query: `metadata["userId"]:"${userId}"`,
      limit: 1,
    });
    customerId = found.data[0]?.id ?? null;
  } catch {
    // Search is best-effort; fall through to creating a customer.
  }

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
  }

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customerId },
    update: { stripeCustomerId: customerId },
  });
  return customerId;
}
