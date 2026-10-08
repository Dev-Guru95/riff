import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { configuredProviders } from "@/lib/social-providers";
import { parseJson, parseJsonArray } from "@/lib/mobile/server";
import type { AuditResponse } from "@/lib/mobile/types";

// GET /api/mobile/audit — src/app/(app)/audit/page.tsx. Social accounts are
// selected field-by-field: access/refresh tokens never leave the server.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [accounts, report, runCount] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { userId: session.id },
      orderBy: { connectedAt: "asc" },
      select: { id: true, platform: true, handle: true, connectVia: true, status: true, connectedAt: true },
    }),
    prisma.auditReport.findFirst({ where: { userId: session.id }, orderBy: { createdAt: "desc" } }),
    prisma.auditSnapshot.count({ where: { userId: session.id } }),
  ]);

  const body: AuditResponse = {
    oauthProviders: configuredProviders(),
    accounts: accounts.map((a) => ({ ...a, connectedAt: a.connectedAt.toISOString() })),
    report: report
      ? {
          marketingScore: report.marketingScore,
          brandingScore: report.brandingScore,
          growthScore: report.growthScore,
          consistencyScore: report.consistencyScore,
          deltas: parseJson<Record<string, number>>(report.deltas, {}),
          recommendations: parseJsonArray<string>(report.recommendations).map(String),
          createdAt: report.createdAt.toISOString(),
        }
      : null,
    runCount,
  };
  return ok(body);
});
