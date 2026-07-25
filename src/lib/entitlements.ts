import { prisma } from "./prisma";
import type { PlanKey } from "./stripe";

// Per-plan entitlements. Gate features against these so upgrades unlock value.
export const ENTITLEMENTS: Record<PlanKey, { coachMessagesPerDay: number; socialConnections: number; allCourses: boolean; humanReview: boolean }> = {
  free: { coachMessagesPerDay: 5, socialConnections: 1, allCourses: false, humanReview: false },
  pro: { coachMessagesPerDay: 1000, socialConnections: 6, allCourses: true, humanReview: false },
  premium: { coachMessagesPerDay: 5000, socialConnections: 6, allCourses: true, humanReview: true },
};

export async function getPlan(userId: string): Promise<PlanKey> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return "free";
  // Only an active/trialing subscription grants paid entitlements.
  if (sub.status === "active" || sub.status === "trialing") return sub.plan as PlanKey;
  return "free";
}

export async function getEntitlements(userId: string) {
  const plan = await getPlan(userId);
  return { plan, ...ENTITLEMENTS[plan] };
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
