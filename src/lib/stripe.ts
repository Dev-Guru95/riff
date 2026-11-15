import Stripe from "stripe";

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

export const PLANS: Record<
  PlanKey,
  { name: string; priceMonthly: number; priceId?: string; lookupKey?: string; entitlements: string[]; features: string[] }
> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    entitlements: [],
    features: ["First course module", "AI Coach (Skool members)", "1 social connection", "Monthly audit (1 platform)", "Community (read)"],
  },
  pro: {
    name: "Pro",
    priceMonthly: 19,
    priceId: process.env.STRIPE_PRICE_PRO,
    lookupKey: "riff_pro_monthly",
    // Entitlement ids are shared with RevenueCat: the identifiers configured on
    // the RevenueCat project must match these exactly, or a mobile sign-in will
    // resolve to the wrong plan.
    entitlements: ["pro"],
    features: ["All courses", "Unlimited coach", "All socials audited", "Weekly missions", "Full roadmap", "Leaderboard rewards"],
  },
  premium: {
    name: "Premium",
    priceMonthly: 39,
    priceId: process.env.STRIPE_PRICE_PREMIUM,
    lookupKey: "riff_premium_monthly",
    entitlements: ["pro", "premium"],
    features: ["Everything in Pro", "Priority human-reviewed assignments", "Deeper audits", "1:1 roadmap reviews", "Accountability groups", "Early content"],
  },
};

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
  if (priceId && priceId === PLANS.premium.priceId) return "premium";
  if (priceId && priceId === PLANS.pro.priceId) return "pro";
  return "free";
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

  if (price.lookup_key === PLANS.premium.lookupKey) return "premium";
  if (price.lookup_key === PLANS.pro.lookupKey) return "pro";

  return "free";
}

/** The plan a Stripe subscription grants, or "free" when it no longer grants one. */
export function planForSubscription(sub: Stripe.Subscription): PlanKey {
  if (!statusGrantsAccess(sub.status)) return "free";
  return planForPrice(sub.items.data[0]?.price);
}

export const APP_URL = process.env.APP_URL || "http://localhost:3000";
