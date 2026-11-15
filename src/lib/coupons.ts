import { prisma } from "./prisma";
import { BILLING_CURRENCY, PLANS, type PlanKey } from "./stripe";

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

/** The price a plan is listed at, in minor units (integer — never float cents). */
export function planPriceCents(plan: PlanKey): number {
  return Math.round(PLANS[plan].priceMonthly * 100);
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
  opts: { plan: PlanKey; alreadyRedeemed: boolean; now?: Date },
): QuoteResult {
  const now = opts.now ?? new Date();
  const plan = opts.plan;

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

  const originalCents = planPriceCents(plan);
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
export async function quoteCoupon(userId: string, rawCode: string, plan: PlanKey): Promise<QuoteResult> {
  const code = normalizeCode(rawCode);
  if (!code) return refuse("invalid");

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return refuse("invalid");

  const already = await prisma.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });

  return evaluateCoupon(coupon, { plan, alreadyRedeemed: !!already });
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
