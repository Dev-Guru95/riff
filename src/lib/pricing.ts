/**
 * Riff subscription pricing — the single source of truth.
 *
 * Everything that quotes, displays or charges a price reads from here: the
 * pricing page, the upgrade buttons, Stripe Checkout, the discount quote
 * endpoint, the mobile billing payload and the Terms page. Nothing else may
 * hardcode an amount.
 *
 * This module is deliberately **pure** — no `process.env`, no database, no
 * Stripe import — so it can be imported by client components without Next
 * inlining `undefined` for a server-only env var. The Stripe price ids that
 * belong to these amounts live in `src/lib/stripe.ts`, which is server-only.
 */

export type BillingInterval = "monthly" | "annual";
export type PaidPlanKey = "pro" | "premium";

export const BILLING_INTERVALS: BillingInterval[] = ["monthly", "annual"];
export const PAID_PLANS: PaidPlanKey[] = ["pro", "premium"];

/**
 * List prices, in minor units (cents). Integers only — a float price is how a
 * displayed total and a charged total drift apart.
 *
 * Pro is the anchor: $29.99/mo, $299.99/yr.
 *
 * Premium is *derived*, not chosen. Before this update Pro was $19/mo and
 * Premium $39/mo — Premium sat at 2.05x Pro. Holding that relationship against
 * the new Pro anchor gives 29.99 x 2.05 = $61.56, and the nearest credible
 * price point on that multiple is $59.99 (exactly 2.00x Pro, 0.03x off the old
 * ratio). Annual follows the same rule as Pro.
 *
 * Annual is priced at 10 months for 12 ("2 months free"), so it is ten times
 * the monthly amount, less a cent of rounding:
 *   pro:     29.99 x 10 = 299.90 -> 299.99
 *   premium: 59.99 x 10 = 599.90 -> 599.99
 * `pricing.unit.test.ts` asserts both relationships, so a future price edit
 * that breaks the "2 months free" claim fails the tests rather than quietly
 * making the marketing copy untrue.
 */
export const LIST_PRICE_CENTS: Record<PaidPlanKey, Record<BillingInterval, number>> = {
  pro: { monthly: 2999, annual: 29999 },
  premium: { monthly: 5999, annual: 59999 },
};

/**
 * BFCM launch-offer prices, in minor units.
 *
 * Written out rather than computed from a percentage on purpose. A 50% cut of
 * $29.99 is $14.995, and whichever way that is rounded the *displayed* price
 * and the *charged* price end up a cent apart. Stating the promotional amount
 * and deriving the discount from it (see {@link promoDiscountCents}) means
 * Stripe is handed an exact `amount_off` and the artist is charged the number
 * on the card they clicked.
 *
 * The headline is still a true "50% off": 1500/2999 = 50.02%.
 */
export const PROMO_PRICE_CENTS: Record<PaidPlanKey, Record<BillingInterval, number>> = {
  pro: { monthly: 1499, annual: 14999 },
  premium: { monthly: 2999, annual: 29999 },
};

export type PromoCampaign = {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  percentOff: number;
  tagline: string;
  startsAt: string;
  endsAt: string;
  monthlyDurationMonths: number;
  enabled: boolean;
};

/** The campaign itself. One object to switch the whole offer on, off or over. */
export const PROMO: PromoCampaign = {
  /** Stable id. Stamped on Stripe coupons and subscription metadata. */
  id: "bfcm2026",
  name: "BFCM Launch Offer",
  shortName: "BFCM",
  badge: "50% OFF",
  percentOff: 50,
  tagline: "Our first-ever Black Friday / Cyber Monday offer — 50% off every plan.",
  /** Inclusive start, exclusive end. Absolute instants, not local dates. */
  startsAt: "2026-11-19T00:00:00.000Z",
  /** Midnight PT on Dec 3 2026 — the end of Cyber Monday week. */
  endsAt: "2026-12-03T08:00:00.000Z",
  /**
   * How many monthly billing periods the discounted rate holds for before the
   * list price resumes. An annual plan is discounted for its first year (one
   * period) whatever this says. Set to 0 for a rate that never expires.
   */
  monthlyDurationMonths: 12,
  /** Master switch. Flip to false to end the campaign early, everywhere. */
  enabled: true,
};

/** Is the launch offer live right now? */
export function isPromoActive(now: Date = new Date()): boolean {
  if (!PROMO.enabled) return false;
  const t = now.getTime();
  return t >= Date.parse(PROMO.startsAt) && t < Date.parse(PROMO.endsAt);
}

/** When the offer closes. */
export function promoEndsAt(): Date {
  return new Date(PROMO.endsAt);
}

/** Whole days left in the offer (0 once it has closed). */
export function promoDaysLeft(now: Date = new Date()): number {
  const ms = Date.parse(PROMO.endsAt) - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** The list price of a plan on an interval, in minor units. */
export function listPriceCents(plan: PaidPlanKey, interval: BillingInterval = "monthly"): number {
  return LIST_PRICE_CENTS[plan][interval];
}

/** The launch-offer price of a plan on an interval, in minor units. */
export function promoPriceCents(plan: PaidPlanKey, interval: BillingInterval = "monthly"): number {
  return PROMO_PRICE_CENTS[plan][interval];
}

/**
 * What the launch offer takes off, in minor units. This exact figure is handed
 * to Stripe as a fixed `amount_off`, which is what keeps the charge equal to
 * the advertised price.
 */
export function promoDiscountCents(plan: PaidPlanKey, interval: BillingInterval = "monthly"): number {
  return Math.max(0, listPriceCents(plan, interval) - promoPriceCents(plan, interval));
}

/**
 * What a plan actually costs right now — the promotional price while the
 * campaign is live, the list price otherwise.
 */
export function effectivePriceCents(
  plan: PaidPlanKey,
  interval: BillingInterval = "monthly",
  now: Date = new Date(),
): number {
  return isPromoActive(now) ? promoPriceCents(plan, interval) : listPriceCents(plan, interval);
}

/** The real percentage off, rounded — never more than the headline claims. */
export function actualPercentOff(plan: PaidPlanKey, interval: BillingInterval = "monthly"): number {
  const list = listPriceCents(plan, interval);
  if (list <= 0) return 0;
  return Math.round((promoDiscountCents(plan, interval) / list) * 100);
}

/** An annual price expressed per month, in minor units ("$25.00/mo billed annually"). */
export function perMonthOnAnnualCents(cents: number): number {
  return Math.round(cents / 12);
}

/** What an annual plan saves against twelve monthly charges, in minor units. */
export function annualSavingCents(plan: PaidPlanKey, promo = false): number {
  const price = promo ? promoPriceCents : listPriceCents;
  return Math.max(0, price(plan, "monthly") * 12 - price(plan, "annual"));
}

/** That saving as a percentage of twelve monthly charges. */
export function annualSavingPct(plan: PaidPlanKey, promo = false): number {
  const price = promo ? promoPriceCents : listPriceCents;
  const year = price(plan, "monthly") * 12;
  if (year <= 0) return 0;
  return Math.round((annualSavingCents(plan, promo) / year) * 100);
}

/**
 * The annual saving expressed in free months — the "2 months free" claim.
 * Derived, so it cannot drift away from the prices above.
 */
export function monthsFreeOnAnnual(plan: PaidPlanKey, promo = false): number {
  const monthly = (promo ? promoPriceCents : listPriceCents)(plan, "monthly");
  if (monthly <= 0) return 0;
  return Math.round(annualSavingCents(plan, promo) / monthly);
}

/** How long the promotional rate holds, as a fine-print fragment. */
export function promoHoldsFor(interval: BillingInterval): string {
  if (interval === "annual") return "your first year";
  if (PROMO.monthlyDurationMonths <= 0) return "as long as you stay subscribed";
  return `your first ${PROMO.monthlyDurationMonths} months`;
}

/** Human label for an interval. */
export function intervalLabel(interval: BillingInterval): string {
  return interval === "annual" ? "year" : "month";
}

/** Short suffix for a price, e.g. "/mo". */
export function intervalSuffix(interval: BillingInterval): string {
  return interval === "annual" ? "/yr" : "/mo";
}

/**
 * Everything the UI needs to render one plan on one interval, resolved once on
 * the server so the client cannot disagree about whether the offer is live.
 */
export type PriceView = {
  plan: PaidPlanKey;
  interval: BillingInterval;
  /** The undiscounted price. Shown struck through during the offer. */
  listCents: number;
  /** What is charged today. */
  payCents: number;
  /** listCents - payCents. 0 outside the offer. */
  discountCents: number;
  /** True while the launch offer is live. */
  promo: boolean;
  percentOff: number;
  /** payCents expressed per month — equal to payCents on a monthly plan. */
  perMonthCents: number;
  /** What choosing annual saves against twelve monthly charges, at today's prices. */
  annualSavingCents: number;
  monthsFree: number;
  /** "your first 12 months" / "your first year". */
  holdsFor: string;
  /** The price that resumes afterwards. null when nothing changes. */
  thenCents: number | null;
};

/** Resolve a plan + interval into a ready-to-render price. */
export function priceView(
  plan: PaidPlanKey,
  interval: BillingInterval,
  now: Date = new Date(),
): PriceView {
  const promo = isPromoActive(now);
  const listCents = listPriceCents(plan, interval);
  const payCents = promo ? promoPriceCents(plan, interval) : listCents;
  return {
    plan,
    interval,
    listCents,
    payCents,
    discountCents: listCents - payCents,
    promo,
    percentOff: promo ? actualPercentOff(plan, interval) : 0,
    perMonthCents: interval === "annual" ? perMonthOnAnnualCents(payCents) : payCents,
    annualSavingCents: annualSavingCents(plan, promo),
    monthsFree: monthsFreeOnAnnual(plan, promo),
    holdsFor: promoHoldsFor(interval),
    thenCents: promo ? listCents : null,
  };
}

/** Both intervals for one plan, for a card that flips between them. */
export function planPrices(plan: PaidPlanKey, now: Date = new Date()): Record<BillingInterval, PriceView> {
  return { monthly: priceView(plan, "monthly", now), annual: priceView(plan, "annual", now) };
}
