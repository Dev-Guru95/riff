import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runAudit } from "@/lib/audit";
import { track } from "@/lib/analytics";
import { ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

export const POST = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`ai:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const result = await runAudit(session.id);
  if ("error" in result && result.error) return fail(result.error, 400);
  await track("audit_run", session.id, {});

  return ok({
    report: {
      marketingScore: result.report.marketingScore,
      brandingScore: result.report.brandingScore,
      growthScore: result.report.growthScore,
      consistencyScore: result.report.consistencyScore,
      deltas: JSON.parse(result.report.deltas),
      recommendations: JSON.parse(result.report.recommendations),
    },
    totalFollowers: result.totalFollowers,
  });
});

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const report = await prisma.auditReport.findFirst({ where: { userId: session.id }, orderBy: { createdAt: "desc" } });
  return ok({ report });
});
