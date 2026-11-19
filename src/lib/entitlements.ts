import { prisma } from "./prisma";
import { intervalForPriceId, type PlanKey } from "./stripe";

/** The roadmap horizons the AI career planner can be asked for. */
export const ROADMAP_HORIZONS = ["30d", "90d", "6m", "12m"] as const;
export type RoadmapHorizonKey = (typeof ROADMAP_HORIZONS)[number];

export type PlanEntitlements = {
  coachMessagesPerDay: number;
  socialConnections: number;
  /**
   * Access to every course track. True on every plan: Riff is the assessment
   * half of the Skool loop (learners arrive by deep link to take a quiz), so
   * paywalling a track would break the loop. Kept as a field because the
   * mobile clients read it.
   */
  allCourses: boolean;
  humanReview: boolean;
  weeklyMissions: boolean;
  /** Which career-roadmap horizons can be generated. Free is the 30-day plan. */
  roadmapHorizons: readonly RoadmapHorizonKey[];
  /** AI merch concept plans per day. 0 means the generator is not available. */
  merchPlansPerDay: number;
  /** Whether the AI can also write a week-by-week merch launch campaign. */
  merchCampaignPlans: boolean;
  /** Longer, more detailed AI output on the tools that generate plans. */
  extendedAiDepth: boolean;
};

// Per-plan entitlements. Gate features against these so upgrades unlock value.
//
// Every line here is enforced somewhere — a feature sold on the Plans page but
// not checked in code is the contradiction reviewers found last time
// (`weeklyMissions` was advertised as Pro while Free users could complete them
// for XP). `plan-features.ts` is the copy that describes this table; the two
// are meant to be read side by side.
export const ENTITLEMENTS: Record<PlanKey, PlanEntitlements> = {
  free: {
    coachMessagesPerDay: 5,
    socialConnections: 1,
    allCourses: true,
    humanReview: false,
    weeklyMissions: false,
    roadmapHorizons: ["30d"],
    merchPlansPerDay: 0,
    merchCampaignPlans: false,
    extendedAiDepth: false,
  },
  pro: {
    coachMessagesPerDay: 1000,
    socialConnections: 6,
    allCourses: true,
    humanReview: false,
    weeklyMissions: true,
    roadmapHorizons: ROADMAP_HORIZONS,
    merchPlansPerDay: 3,
    merchCampaignPlans: false,
    extendedAiDepth: false,
  },
  premium: {
    coachMessagesPerDay: 5000,
    socialConnections: 6,
    allCourses: true,
    humanReview: true,
    weeklyMissions: true,
    roadmapHorizons: ROADMAP_HORIZONS,
    merchPlansPerDay: 12,
    merchCampaignPlans: true,
    extendedAiDepth: true,
  },
};

/** The subscription fields that decide access. */
type AccessRow = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  /** stripe | app_store | play_store | promo. Absent on older callers. */
  provider?: string;
};

/**
 * Decide the effective plan from a subscription row.
 *
 * Pure, so the rule is unit-testable and identical everywhere it is applied —
 * the web app, the mobile API and the admin screens must never disagree about
 * whether someone is paid up.
 */
export function planFromSubscription(sub: AccessRow | null | undefined, now: Date = new Date()): PlanKey {
  if (!sub) return "free";
  const plan = sub.plan as PlanKey;
  if (plan !== "pro" && plan !== "premium") return "free";

  // A plan activated with a 100%-off code has no store behind it: nothing will
  // ever send a webhook to end it, so the end date on the row is the only thing
  // that can. Without this a one-month free code would grant Pro forever.
  if (sub.provider === "promo" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) return "free";

  if (sub.status === "active" || sub.status === "trialing") return plan;

  // Billing-retry grace. Stripe holds a subscription at `past_due` while it
  // retries the card, and RevenueCat only confirms a renewal after payment
  // clears. Revoking the moment the status changes would lock a paying artist
  // out over a temporary decline, so access runs to the end of the period they
  // already paid for.
  if ((sub.status === "past_due" || sub.status === "unpaid") && sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    return plan;
  }

  return "free";
}

export async function getPlan(userId: string): Promise<PlanKey> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true, provider: true },
  });
  return planFromSubscription(sub);
}

export async function getEntitlements(userId: string) {
  const plan = await getPlan(userId);
  return { plan, ...ENTITLEMENTS[plan] };
}

/** True when the user currently holds a named entitlement (mirrors RevenueCat ids). */
export async function hasEntitlement(userId: string, entitlementId: string): Promise<boolean> {
  const plan = await getPlan(userId);
  if (plan === "premium") return entitlementId === "pro" || entitlementId === "premium";
  if (plan === "pro") return entitlementId === "pro";
  return false;
}

/** Everything the billing UI and the mobile client need in one read. */
export async function getBillingSummary(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const plan = planFromSubscription(sub);
  return {
    plan,
    entitlements: ENTITLEMENTS[plan],
    subscription: sub
      ? {
          status: sub.status,
          provider: sub.provider,
          /** monthly | annual — derived from the Stripe price that is billed. */
          interval: intervalForPriceId(sub.stripePriceId),
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt,
          startedAt: sub.startedAt,
          endedAt: sub.endedAt,
          entitlementIds: safeParseIds(sub.entitlements),
          revenueCatSynced: !!sub.revenueCatSyncedAt,
          hasBillingAccount: !!sub.stripeCustomerId,
        }
      : null,
  };
}

function safeParseIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * How many AI merch plans this artist has left today.
 *
 * Counted the same way as coach messages — from the analytics events already
 * written for every generation — so there is no second place for the number to
 * drift out of step. Returns `limit: 0` when the plan has no access at all,
 * which is what the upgrade prompt renders from.
 */
export async function merchPlanQuota(userId: string): Promise<{
  plan: PlanKey;
  limit: number;
  used: number;
  remaining: number;
  campaigns: boolean;
  /** Longer, more detailed AI output — the "Extended" row on the Plans page. */
  extended: boolean;
}> {
  const plan = await getPlan(userId);
  const {
    merchPlansPerDay: limit,
    merchCampaignPlans: campaigns,
    extendedAiDepth: extended,
  } = ENTITLEMENTS[plan];
  if (limit <= 0) return { plan, limit: 0, used: 0, remaining: 0, campaigns, extended };

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const used = await prisma.analyticsEvent.count({
    where: { userId, type: "merch_plan", createdAt: { gte: since } },
  });
  return { plan, limit, used, remaining: Math.max(0, limit - used), campaigns, extended };
}

/** True when the plan may generate the given career-roadmap horizon. */
export async function canGenerateRoadmap(userId: string, horizon: string): Promise<boolean> {
  const { roadmapHorizons } = await getEntitlements(userId);
  return (roadmapHorizons as readonly string[]).includes(horizon);
}

/** True when the user is still under their daily coach-message quota. */
export async function withinCoachQuota(userId: string): Promise<boolean> {
  const { coachMessagesPerDay } = await getEntitlements(userId);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const used = await prisma.analyticsEvent.count({
    where: { userId, type: "coach_message", createdAt: { gte: since } },
  });
  return used < coachMessagesPerDay;
}
