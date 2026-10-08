import Stripe from "stripe";

// Stripe is optional: when STRIPE_SECRET_KEY is unset the whole billing surface
// degrades gracefully to a "not configured" state instead of crashing.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function isStripeConfigured(): boolean {
  return !!stripe;
}

export type PlanKey = "free" | "pro" | "premium";

export const PLANS: Record<PlanKey, { name: string; priceMonthly: number; priceId?: string; features: string[] }> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    features: ["First course module", "AI Coach (Skool members)", "1 social connection", "Monthly audit (1 platform)", "Community (read)"],
  },
  pro: {
    name: "Pro",
    priceMonthly: 19,
    priceId: process.env.STRIPE_PRICE_PRO,
    features: ["All courses", "Unlimited coach", "All socials audited", "Weekly missions", "Full roadmap", "Leaderboard rewards"],
  },
  premium: {
    name: "Premium",
    priceMonthly: 39,
    priceId: process.env.STRIPE_PRICE_PREMIUM,
    features: ["Everything in Pro", "Priority human-reviewed assignments", "Deeper audits", "1:1 roadmap reviews", "Accountability groups", "Early content"],
  },
};

/** Resolve which plan a Stripe price id maps back to (for webhooks). */
export function planForPriceId(priceId: string | null | undefined): PlanKey {
  if (priceId && priceId === PLANS.premium.priceId) return "premium";
  if (priceId && priceId === PLANS.pro.priceId) return "pro";
  return "free";
}

export const APP_URL = process.env.APP_URL || "http://localhost:3000";
