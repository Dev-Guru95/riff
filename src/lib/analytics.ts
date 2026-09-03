import { prisma } from "./prisma";

export type EventType =
  | "lesson_complete"
  | "quiz_pass"
  | "quiz_fail"
  | "assignment_submit"
  | "xp_earned"
  | "audit_run"
  | "coach_message"
  | "mission_complete"
  | "community_request"
  | "community_join"
  | "certificate_issued"
  | "share_to_skool"
  | "login"
  | "signup";

/** Fire-and-forget event tracking. Never blocks or throws into the request path. */
export async function track(type: EventType, userId: string | null, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({ data: { type, userId, meta: JSON.stringify(meta) } });
  } catch (e) {
    console.error("[analytics] failed", e);
  }
}

/**
 * Signup attribution rollup: how many accounts each `?ref=` link produced.
 *
 * Counted off `User.referralSource` rather than the `signup` AnalyticsEvent
 * because that is the durable record — analytics rows are a time series and may
 * be pruned, whereas the user row is the account itself. Untagged signups
 * (direct traffic) are returned under a null source so the numbers reconcile
 * against the total.
 */
export async function getSignupsBySource(): Promise<{ source: string | null; count: number }[]> {
  const rows = await prisma.user.groupBy({
    by: ["referralSource"],
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ source: r.referralSource, count: r._count._all }))
    .sort((a, b) => b.count - a.count || (a.source ?? "").localeCompare(b.source ?? ""));
}

/** KPI rollup for the admin dashboard. */
export async function getKpis(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const events = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const map = Object.fromEntries(events.map((e) => [e.type, e._count._all]));
  const activeUsers = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since }, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return {
    days,
    activeUsers: activeUsers.length,
    lessonCompletions: map["lesson_complete"] ?? 0,
    quizPasses: map["quiz_pass"] ?? 0,
    assignmentSubmits: map["assignment_submit"] ?? 0,
    coachMessages: map["coach_message"] ?? 0,
    auditRuns: map["audit_run"] ?? 0,
    missionCompletions: map["mission_complete"] ?? 0,
    signups: map["signup"] ?? 0,
  };
}
