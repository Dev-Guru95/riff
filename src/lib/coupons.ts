import { prisma } from "./prisma";
import { BILLING_CURRENCY, PLANS, type PlanKey } from "./stripe";
import {
  PROMO,
  isPromoActive,
  listPriceCents,
  promoDiscountCents,
  promoHoldsFor,
  type BillingInterval,
  type PaidPlanKey,
} from "./pricing";

/**
 * Discount codes, priced.
 *
 * One place decides what a code is worth, so the website, the app and the
 * Stripe checkout can never disagree about a price. Nothing here trusts a
 * client-supplied amount: the caller sends a code and a plan, and the original
 * price comes from PLANS on the server. A client that posts
 * `{ finalCents: 0 }` gets the real quote back, not its own number.
 */

/** Why a code was refused. The app maps these to its own copy; the message is the fallback. */
export type CouponRefusal =
  | "invalid" // no such code
  | "inactive" // switched off by an admin
  | "expired"
  | "exhausted" // maxRedemptions reached
  | "already_used" // this artist has redeemed it before
  | "not_applicable" // valid, but not for this plan
  | "not_a_discount"; // a leaderboard reward code, redeemed elsewhere

export type DiscountQuote = {
  code: string;
  description: string;
  /** percent | fixed */
  type: string;
  value: number;
  plan: PlanKey;
  planName: string;
  /** Which price the code was quoted against. Monthly unless asked otherwise. */
  interval: BillingInterval;
  currency: string;
  /** The plan's list price, in minor units. */
  originalCents: number;
  /** What the code takes off, in minor units. Never more than the price. */
  discountCents: number;
  /** What is actually payable, in minor units. */
  finalCents: number;
  /** finalCents === 0 — the subscription can be activated without a payment. */
  free: boolean;
  /** Months of access a free activation grants. 0 = no end date. */
  durationMonths: number;
};

export type QuoteResult =
  | { ok: true; quote: DiscountQuote }
  | { ok: false; reason: CouponRefusal; message: string; status: number };

const MESSAGES: Record<CouponRefusal, string> = {
  invalid: "That code isn't valid. Check it and try again.",
  inactive: "That code is no longer active.",
  expired: "That code has expired.",
  exhausted: "That code has been fully redeemed.",
  already_used: "You've already used that code.",
  not_applicable: "That code doesn't apply to this plan.",
  not_a_discount: "That's a reward code — redeem it on the Leaderboard, not at checkout.",
};

const STATUS: Record<CouponRefusal, number> = {
  invalid: 404,
  inactive: 404,
  expired: 410,
  exhausted: 409,
  already_used: 409,
  not_applicable: 409,
  not_a_discount: 409,
};

function refuse(reason: CouponRefusal): QuoteResult {
  return { ok: false, reason, message: MESSAGES[reason], status: STATUS[reason] };
}

/** Codes are stored and compared uppercase, so case never decides a discount. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * The price a plan is listed at, in minor units (integer — never float cents).
 *
 * Codes are always quoted against the *list* price, never against the BFCM
 * price. The launch offer and a discount code are alternatives, not layers:
 * the checkout endpoint applies whichever is worth more to the artist, which
 * is only comparable if both are measured from the same starting figure.
 */
export function planPriceCents(plan: PlanKey, interval: BillingInterval = "monthly"): number {
  if (plan === "free") return 0;
  return listPriceCents(plan, interval);
}

/** The coupon fields that decide a quote. A subset of the Prisma row. */
export type CouponRules = {
  code: string;
  type: string;
  value: number;
  description: string;
  active: boolean;
  expiresAt: Date | null;
  maxRedemptions: number;
  redeemed: number;
  /** Comma-separated plan keys; empty means every paid plan. */
  plans: string;
  durationMonths: number;
};

/**
 * Price a coupon against a plan. Pure, so every refusal path is testable
 * without a database and the rule is identical wherever it is applied — the
 * quote endpoint, the redeem endpoint and Stripe checkout must never disagree
 * about what a code is worth.
 */
export function evaluateCoupon(
  coupon: CouponRules | null,
  opts: { plan: PlanKey; interval?: BillingInterval; alreadyRedeemed: boolean; now?: Date },
): QuoteResult {
  const now = opts.now ?? new Date();
  const plan = opts.plan;
  const interval: BillingInterval = opts.interval ?? "monthly";

  if (!coupon) return refuse("invalid");
  if (!coupon.active) return refuse("inactive");
  if (coupon.type === "reward") return refuse("not_a_discount");
  if (coupon.expiresAt && coupon.expiresAt <= now) return refuse("expired");
  if (coupon.maxRedemptions > 0 && coupon.redeemed >= coupon.maxRedemptions) return refuse("exhausted");

  // Scope: empty `plans` means every paid plan.
  const scope = coupon.plans
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (scope.length > 0 && !scope.includes(plan)) return refuse("not_applicable");

  if (opts.alreadyRedeemed) return refuse("already_used");

  const originalCents = planPriceCents(plan, interval);
  const discountCents = discountFor(coupon.type, coupon.value, originalCents);
  const finalCents = Math.max(0, originalCents - discountCents);

  return {
    ok: true,
    quote: {
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.value,
      plan,
      planName: PLANS[plan].name,
      interval,
      currency: BILLING_CURRENCY,
      originalCents,
      discountCents,
      finalCents,
      free: finalCents === 0,
      durationMonths: coupon.durationMonths,
    },
  };
}

/**
 * Work out what `code` does to `plan` for this artist — without changing
 * anything. Safe to call on every keystroke of an Apply button.
 */
export async function quoteCoupon(
  userId: string,
  rawCode: string,
  plan: PlanKey,
  interval: BillingInterval = "monthly",
): Promise<QuoteResult> {
  const code = normalizeCode(rawCode);
  if (!code) return refuse("invalid");

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return refuse("invalid");

  const already = await prisma.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });

  return evaluateCoupon(coupon, { plan, interval, alreadyRedeemed: !!already });
}

/**
 * Months of access a free activation should grant.
 *
 * A code's `durationMonths` is written with monthly billing in mind, so a code
 * that covers a whole *annual* price has to be worth at least the year that
 * was just given away — otherwise "100% off the annual plan" would hand over
 * one month. 0 still means "no end date".
 */
export function accessMonthsFor(quote: DiscountQuote): number {
  if (quote.durationMonths <= 0) return 0;
  return quote.interval === "annual" ? Math.max(quote.durationMonths, 12) : quote.durationMonths;
}

/**
 * What a code takes off a price, in minor units.
 *
 * `percent` values are percentages (100 = free); `fixed` values are whole
 * currency units (19 = $19 off). Both are clamped to the price, so a discount
 * can never make a total negative — which is what a "refund" bug looks like.
 */
export function discountFor(type: string, value: number, originalCents: number): number {
  if (originalCents <= 0) return 0;
  const raw =
    type === "percent"
      ? Math.round((originalCents * Math.min(Math.max(value, 0), 100)) / 100)
      : Math.round(Math.max(value, 0) * 100);
  return Math.min(raw, originalCents);
}

/** The end of a free activation's access, or null when it never ends. */
export function promoPeriodEnd(durationMonths: number, from: Date = new Date()): Date | null {
  if (durationMonths <= 0) return null;
  const end = new Date(from);
  end.setMonth(end.getMonth() + durationMonths);
  return end;
}

/**
 * The Stripe coupon that matches a quote, created on first use.
 *
 * A partial discount still has to be charged, and Stripe is what charges it —
 * so the discount is handed to Checkout as a real Stripe coupon rather than by
 * us sending a smaller number. The id encodes everything that affects the
 * money (code, plan, type, value, duration), so editing a Riff coupon produces
 * a *new* Stripe coupon instead of silently reusing the old terms.
 *
 * Returns null when Stripe is not configured or the quote is free (a free plan
 * is activated by /api/billing/redeem, not bought).
 */
export async function ensureStripeCoupon(quote: DiscountQuote): Promise<string | null> {
  const { stripe } = await import("./stripe");
  if (!stripe || quote.free || quote.discountCents <= 0) return null;

  const id = `riff_${quote.code}_${quote.plan}_${quote.type}${String(quote.value).replace(/\./g, "_")}_${quote.durationMonths}`
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 100);

  try {
    const found = await stripe.coupons.retrieve(id);
    if (found && !found.deleted) return found.id;
  } catch {
    // Not there yet — fall through and create it.
  }

  const duration =
    quote.durationMonths <= 0
      ? ({ duration: "forever" } as const)
      : quote.durationMonths === 1
        ? ({ duration: "once" } as const)
        : ({ duration: "repeating", duration_in_months: quote.durationMonths } as const);

  const created = await stripe.coupons.create({
    id,
    name: quote.description || `Riff code ${quote.code}`,
    ...duration,
    ...(quote.type === "percent"
      ? { percent_off: Math.min(Math.max(quote.value, 0), 100) }
      : { amount_off: quote.discountCents, currency: quote.currency }),
    metadata: { riffCode: quote.code, plan: quote.plan },
  });
  return created.id;
}

// ---- The BFCM launch offer ------------------------------------------------
// The campaign is not a Coupon row and has no code to type: it is applied
// automatically for the window defined in `pricing.ts`. It reaches Stripe the
// same way a code does, as a real Stripe coupon, so what Stripe charges is
// what the pricing page advertised.

export type CampaignDiscount = {
  /** The campaign id, e.g. "bfcm2026". */
  campaign: string;
  name: string;
  /** What it takes off this plan + interval, in minor units. */
  discountCents: number;
  /** What is payable after it, in minor units. */
  finalCents: number;
  originalCents: number;
  percentOff: number;
  /** "your first 12 months" / "your first year". */
  holdsFor: string;
};

/**
 * The launch-offer discount for a plan + interval, or null when the campaign
 * is not running. Priced from `pricing.ts`, never from a request.
 */
export function campaignDiscount(
  plan: PaidPlanKey,
  interval: BillingInterval = "monthly",
  now: Date = new Date(),
): CampaignDiscount | null {
  if (!isPromoActive(now)) return null;
  const originalCents = listPriceCents(plan, interval);
  const discountCents = promoDiscountCents(plan, interval);
  if (discountCents <= 0) return null;
  return {
    campaign: PROMO.id,
    name: PROMO.name,
    discountCents,
    finalCents: originalCents - discountCents,
    originalCents,
    percentOff: Math.round((discountCents / originalCents) * 100),
    holdsFor: promoHoldsFor(interval),
  };
}

/**
 * The Stripe coupon that applies the launch offer, created on first use.
 *
 * Deliberately a fixed `amount_off` rather than `percent_off`: 50% of $29.99
 * is $14.995, so a percentage coupon would charge a cent more or less than the
 * $14.99 on the pricing page. The amount is derived from the two prices in
 * `pricing.ts`, so the charge always equals the advertised figure.
 *
 * The id encodes the campaign, plan, interval and amount, so changing the
 * offer produces a *new* coupon instead of silently reusing the old terms.
 */
export async function ensureCampaignCoupon(
  plan: PaidPlanKey,
  interval: BillingInterval,
  now: Date = new Date(),
): Promise<string | null> {
  const discount = campaignDiscount(plan, interval, now);
  if (!discount) return null;

  const { stripe } = await import("./stripe");
  if (!stripe) return null;

  const id = `riff_${PROMO.id}_${plan}_${interval}_${discount.discountCents}`
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 100);

  try {
    const found = await stripe.coupons.retrieve(id);
    if (found && !found.deleted) return found.id;
  } catch {
    // Not there yet — fall through and create it.
  }

  // An annual subscription renews once a year, so "the first year" is a single
  // period: `once`. A monthly one holds the rate for the configured number of
  // periods, or forever when that is 0.
  const duration =
    interval === "annual"
      ? ({ duration: "once" } as const)
      : PROMO.monthlyDurationMonths <= 0
        ? ({ duration: "forever" } as const)
        : PROMO.monthlyDurationMonths === 1
          ? ({ duration: "once" } as const)
          : ({ duration: "repeating", duration_in_months: PROMO.monthlyDurationMonths } as const);

  const created = await stripe.coupons.create({
    id,
    name: `${PROMO.name} — ${PLANS[plan].name} ${interval}`,
    amount_off: discount.discountCents,
    currency: BILLING_CURRENCY,
    ...duration,
    metadata: { riffCampaign: PROMO.id, plan, interval },
  });
  return created.id;
}
