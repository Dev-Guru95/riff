import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { quoteCoupon, promoPeriodEnd, accessMonthsFor } from "@/lib/coupons";
import { activatePromoSubscription } from "@/lib/subscriptions";
import { getBillingSummary } from "@/lib/entitlements";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  plan: z.literal("pro"),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
  code: z.string().min(1).max(64),
});

/**
 * POST /api/billing/redeem — activate a plan a code took to zero.
 *
 * The only way to get a paid plan without paying, and it is deliberately
 * narrow: the quote is recomputed here from the database and the code must
 * bring the price to exactly 0. Anything that still costs money is refused and
 * sent to Stripe, so a client cannot talk its way to a free Premium by posting
 * its own totals or by replaying a partial-discount code.
 *
 * Works for the app and the website alike. No charge happens here, so this is
 * not a purchasing mechanism under App Store 3.1.1 — it unlocks content the
 * artist was given, the way a redemption code does.
 */
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const rl = rateLimit(`redeem:${session.id}:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { plan } = body.data;

  // Re-quoted, never trusted from the request.
  const quoted = await quoteCoupon(session.id, body.data.code, plan, body.data.interval);
  if (!quoted.ok) return fail(quoted.message, quoted.status, { reason: quoted.reason });
  const quote = quoted.quote;

  if (!quote.free) {
    return fail("That code reduces the price but doesn't cover it. Finish checkout on the Riff website.", 409, {
      reason: "payment_required",
      discount: quote,
    });
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: quote.code }, select: { id: true } });
  if (!coupon) return fail("That code isn't valid. Check it and try again.", 404, { reason: "invalid" });

  // A code that covered a whole annual price has to be worth at least that
  // year, however the code's own duration was written. See accessMonthsFor().
  const periodEnd = promoPeriodEnd(accessMonthsFor(quote));
  const activated = await activatePromoSubscription(session.id, plan, periodEnd, quote.code);
  if (!activated.ok) {
    return fail(
      "You already have a paid subscription. Change your plan on the Riff website so you aren't billed twice.",
      409,
      { reason: activated.reason },
    );
  }

  // Record the redemption only once the plan is actually on, and in one
  // transaction with the counter: the unique (couponId, userId) key is what
  // makes a double-tap of Confirm land as a single redemption.
  try {
    await prisma.$transaction([
      prisma.couponRedemption.create({ data: { couponId: coupon.id, userId: session.id } }),
      prisma.coupon.update({ where: { id: coupon.id }, data: { redeemed: { increment: 1 } } }),
    ]);
  } catch {
    // Already recorded by a racing request. The plan is on either way, which is
    // the outcome the artist asked for — don't fail them for tapping twice.
  }

  await prisma.analyticsEvent
    .create({ data: { userId: session.id, type: "coupon_activation", meta: JSON.stringify({ code: quote.code, plan }) } })
    .catch(() => {});

  const summary = await getBillingSummary(session.id);
  return ok({
    activated: true,
    plan: summary.plan,
    entitlements: summary.entitlements,
    currentPeriodEnd: periodEnd?.toISOString() ?? null,
    revenueCatSynced: activated.revenueCatSynced,
    discount: quote,
  });
});
