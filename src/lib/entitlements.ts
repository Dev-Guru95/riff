import { prisma } from "./prisma";
import type { PlanKey } from "./stripe";

// Per-plan entitlements. Gate features against these so upgrades unlock value.
export const ENTITLEMENTS: Record<
  PlanKey,
  { coachMessagesPerDay: number; socialConnections: number; allCourses: boolean; humanReview: boolean; weeklyMissions: boolean }
> = {
  // `weeklyMissions` exists because the Plans page has always advertised weekly
  // missions as a Pro feature while the app let Free users complete them for XP
  // — reviewers spotted the contradiction. Pro is the intended tier.
  free: { coachMessagesPerDay: 5, socialConnections: 1, allCourses: false, humanReview: false, weeklyMissions: false },
  pro: { coachMessagesPerDay: 1000, socialConnections: 6, allCourses: true, humanReview: false, weeklyMissions: true },
  premium: { coachMessagesPerDay: 5000, socialConnections: 6, allCourses: true, humanReview: true, weeklyMissions: true },
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
