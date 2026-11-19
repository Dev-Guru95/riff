import Stripe from "stripe";
import {
  BILLING_INTERVALS,
  PAID_PLANS,
  LIST_PRICE_CENTS,
  listPriceCents,
  type BillingInterval,
  type PaidPlanKey,
} from "./pricing";
import { PLAN_HIGHLIGHTS, PLAN_META, type PlanKeyLike } from "./plan-features";

// Stripe is optional: when STRIPE_SECRET_KEY is unset the whole billing surface
// degrades gracefully to a "not configured" state instead of crashing.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

/**
 * Publishable key. Safe to send to the browser — it is the only Stripe value
 * that may ever reach the client. The secret key is read from the environment
 * in this module and never leaves the server.
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

/**
 * The currency every plan is priced in. Stripe decides what a Checkout session
 * is actually charged in (it follows the price object), so this is what we
 * *display* — totals, discounts and the ₦0.00/$0.00 a full-discount code lands
 * on. Set BILLING_CURRENCY to the same currency as the Stripe prices.
 */
export const BILLING_CURRENCY = (process.env.BILLING_CURRENCY || "usd").toLowerCase();

export type PlanKey = "free" | "pro" | "premium";

/** Low to high. Used to tell an upgrade from a downgrade. */
export const PLAN_ORDER: PlanKey[] = ["free", "pro", "premium"];

export function planRank(plan: PlanKey): number {
  return PLAN_ORDER.indexOf(plan);
}

/**
 * The Stripe price behind one plan on one interval.
 *
 * `priceId` comes from the environment so a deployment can point at a
 * different set of prices without a code change; `lookupKey` is the stable
 * fallback used to resolve a webhook when STRIPE_PRICE_* drifts out of sync
 * with the account. Both monthly keys keep their original names so existing
 * deployments are unaffected by the move to two intervals.
 */
export type PlanPriceRef = { priceId?: string; lookupKey: string; amountCents: number };

export const PLAN_PRICES: Record<PaidPlanKey, Record<BillingInterval, PlanPriceRef>> = {
  pro: {
    monthly: {
      priceId: process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_PRO_MONTHLY,
      lookupKey: "riff_pro_monthly",
      amountCents: LIST_PRICE_CENTS.pro.monthly,
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_PRO_ANNUAL,
      lookupKey: "riff_pro_annual",
      amountCents: LIST_PRICE_CENTS.pro.annual,
    },
  },
};

/**
 * Lookup keys and price ids that used to sell Premium.
 *
 * Premium is no longer offered, but a renewal webhook for one of its prices
 * could still arrive, and resolving it to "free" would silently strip someone
 * of access. These map it back to a real plan without making it sellable.
 */
const RETIRED_PRICE_IDS: Record<string, PlanKey> = {
  ...(process.env.STRIPE_PRICE_PREMIUM ? { [process.env.STRIPE_PRICE_PREMIUM]: "premium" as PlanKey } : {}),
  ...(process.env.STRIPE_PRICE_PREMIUM_ANNUAL ? { [process.env.STRIPE_PRICE_PREMIUM_ANNUAL]: "premium" as PlanKey } : {}),
};

const RETIRED_LOOKUP_KEYS: Record<string, PlanKey> = {
  riff_premium_monthly: "premium",
  riff_premium_annual: "premium",
};

export const PLANS: Record<
  PlanKeyLike,
  { name: string; priceMonthly: number; priceId?: string; lookupKey?: string; entitlements: string[]; features: string[] }
> = {
  free: {
    name: PLAN_META.free.name,
    priceMonthly: 0,
    entitlements: [],
    features: PLAN_HIGHLIGHTS.free,
  },
  pro: {
    name: PLAN_META.pro.name,
    // Dollars, for the places that print a round price (Terms, the mobile
    // billing payload). The authoritative figure is in minor units in
    // `pricing.ts` — this is derived from it and never typed twice.
    priceMonthly: listPriceCents("pro", "monthly") / 100,
    priceId: PLAN_PRICES.pro.monthly.priceId,
    lookupKey: PLAN_PRICES.pro.monthly.lookupKey,
    // Entitlement ids are shared with RevenueCat: the identifiers configured on
    // the RevenueCat project must match these exactly, or a mobile sign-in will
    // resolve to the wrong plan.
    entitlements: ["pro"],
    features: PLAN_HIGHLIGHTS.pro,
  },
};

/**
 * Display details for any plan a row might hold, including the retired one.
 *
 * `PLANS` is the sellable catalogue and has no Premium entry. Billing screens
 * still have to render a name for a historical Premium subscription, so they
 * read this instead of indexing PLANS with a key that is no longer there.
 */
export function planDisplay(plan: PlanKey): { name: string; priceMonthly: number } {
  if (plan === "premium") return { name: "Premium (retired)", priceMonthly: 0 };
  return { name: PLANS[plan].name, priceMonthly: PLANS[plan].priceMonthly };
}

/** The Stripe price id to charge for a plan on an interval, or undefined. */
export function priceIdFor(plan: PaidPlanKey, interval: BillingInterval): string | undefined {
  return PLAN_PRICES[plan][interval].priceId;
}

/** Which intervals this deployment can actually sell (a price id is configured). */
export function sellableIntervals(plan: PaidPlanKey): BillingInterval[] {
  return BILLING_INTERVALS.filter((i) => !!priceIdFor(plan, i));
}

/** True when at least one interval of a paid plan can be bought. */
export function canSell(plan: PaidPlanKey): boolean {
  return sellableIntervals(plan).length > 0;
}

/** Statuses Stripe reports that still mean "this person has paid for access". */
const ENTITLING_STATUSES = new Set(["active", "trialing"]);

export function statusGrantsAccess(status: string | null | undefined): boolean {
  return !!status && ENTITLING_STATUSES.has(status);
}

/**
 * Resolve which plan a Stripe price id maps back to (for webhooks).
 *
 * Env price ids are the first source of truth so a deployment can point at a
 * different set of prices without a code change.
 */
export function planForPriceId(priceId: string | null | undefined): PlanKey {
  if (!priceId) return "free";
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (priceId === priceIdFor(plan, interval)) return plan;
    }
  }
  // A retired Premium price can still renew. Resolving it to "free" would
  // strip a historical subscriber of access on their next webhook.
  return RETIRED_PRICE_IDS[priceId] ?? "free";
}

/**
 * Which billing interval a Stripe price id belongs to.
 *
 * Nothing about access depends on this — it is what lets the billing screens
 * say "renews yearly" instead of guessing. Unknown ids fall back to monthly,
 * which is what every subscription sold before annual existed is.
 */
export function intervalForPriceId(priceId: string | null | undefined): BillingInterval {
  if (!priceId) return "monthly";
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (priceId === priceIdFor(plan, interval)) return interval;
    }
  }
  // A price created by hand in the dashboard: fall back to the lookup-key
  // naming convention before giving up.
  return priceId.includes("annual") || priceId.includes("year") ? "annual" : "monthly";
}


function isPlanKey(v: unknown): v is PlanKey {
  return v === "free" || v === "pro" || v === "premium";
}

/**
 * Resolve the plan for a whole Stripe price object.
 *
 * Checks, in order: the env price ids, the `plan` metadata we stamp on every
 * price we create, the product's `plan` metadata, then the lookup key. The
 * metadata fallbacks matter because they keep a subscription resolvable even
 * if STRIPE_PRICE_* drifts out of sync with the account (a price created by
 * hand in the dashboard, or an env var that was never set on one host).
 */
export function planForPrice(price: Stripe.Price | null | undefined): PlanKey {
  if (!price) return "free";

  const byId = planForPriceId(price.id);
  if (byId !== "free") return byId;

  const fromPrice = price.metadata?.plan;
  if (isPlanKey(fromPrice)) return fromPrice;

  // `product` is a string id unless the caller expanded it.
  if (price.product && typeof price.product === "object" && !("deleted" in price.product && price.product.deleted)) {
    const fromProduct = (price.product as Stripe.Product).metadata?.plan;
    if (isPlanKey(fromProduct)) return fromProduct;
  }

  if (price.lookup_key) {
    for (const plan of PAID_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        if (price.lookup_key === PLAN_PRICES[plan][interval].lookupKey) return plan;
      }
    }
    const retired = RETIRED_LOOKUP_KEYS[price.lookup_key];
    if (retired) return retired;
  }

  return "free";
}

/** The billing interval of a whole Stripe price object. */
export function intervalForPrice(price: Stripe.Price | null | undefined): BillingInterval {
  if (!price) return "monthly";
  // Stripe itself knows the recurrence — trust it before our own naming.
  const recurring = price.recurring;
  if (recurring?.interval === "year") return "annual";
  if (recurring?.interval === "month") return recurring.interval_count >= 12 ? "annual" : "monthly";
  return intervalForPriceId(price.id);
}

/** The plan a Stripe subscription grants, or "free" when it no longer grants one. */
export function planForSubscription(sub: Stripe.Subscription): PlanKey {
  if (!statusGrantsAccess(sub.status)) return "free";
  return planForPrice(sub.items.data[0]?.price);
}

export const APP_URL = process.env.APP_URL || "http://localhost:3000";
