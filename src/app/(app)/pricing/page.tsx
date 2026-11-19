import { requirePageSession } from "@/lib/auth";
import { getPlan } from "@/lib/entitlements";
import { isStripeConfigured, BILLING_CURRENCY, sellableIntervals } from "@/lib/stripe";
import {
  PROMO,
  isPromoActive,
  planPrices,
  promoDaysLeft,
  promoEndsAt,
  type PaidPlanKey,
} from "@/lib/pricing";
import { FEATURE_GROUPS, PLAN_HIGHLIGHTS, PLAN_META, PREMIUM_DIFFERENCE, type PlanKeyLike } from "@/lib/plan-features";
import { PlansClient, type PlanCard } from "./PlansClient";

export const metadata = { title: "Plans — Riff" };

const ORDER: PlanKeyLike[] = ["free", "pro", "premium"];

export default async function PricingPage() {
  const session = await requirePageSession();
  const currentPlan = await getPlan(session.id);

  // Resolved once, here, on the server: whether the launch offer is live, what
  // every plan costs on both intervals, and which intervals this deployment
  // can actually sell. The client renders those numbers and never recomputes
  // them, so there is no window in which the page shows a promotional price
  // the checkout endpoint would refuse to honour.
  const now = new Date();
  const plans: PlanCard[] = ORDER.map((key) => ({
    key,
    name: PLAN_META[key].name,
    tagline: PLAN_META[key].tagline,
    audience: PLAN_META[key].audience,
    highlights: PLAN_HIGHLIGHTS[key],
    prices: key === "free" ? null : planPrices(key as PaidPlanKey, now),
    sellable: key === "free" ? [] : sellableIntervals(key as PaidPlanKey),
  }));

  return (
    <PlansClient
      plans={plans}
      groups={FEATURE_GROUPS}
      promo={{
        active: isPromoActive(now),
        name: PROMO.name,
        badge: PROMO.badge,
        tagline: PROMO.tagline,
        // Formatted on the server so the markup it hydrates into matches.
        endsAtLabel: promoEndsAt().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }),
        daysLeft: promoDaysLeft(now),
      }}
      currentPlan={currentPlan}
      currency={BILLING_CURRENCY}
      configured={isStripeConfigured()}
      premiumDifference={PREMIUM_DIFFERENCE}
    />
  );
}
