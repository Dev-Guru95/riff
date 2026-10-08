import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { configuredProviders } from "@/lib/social-providers";
import { AuditClient } from "./AuditClient";

export default async function AuditPage() {
  const session = await requirePageSession();
  const [accounts, report, snapshotCount] = await Promise.all([
    prisma.socialAccount.findMany({ where: { userId: session.id }, orderBy: { connectedAt: "asc" } }),
    prisma.auditReport.findFirst({ where: { userId: session.id }, orderBy: { createdAt: "desc" } }),
    prisma.auditSnapshot.count({ where: { userId: session.id } }),
  ]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">📈 Social Media Audit</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Connect your platforms and track Marketing, Branding, Growth & Consistency scores month over month.
      </p>
      <AuditClient
        oauthProviders={configuredProviders()}
        accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle, connectVia: a.connectVia }))}
        report={
          report
            ? {
                marketingScore: report.marketingScore,
                brandingScore: report.brandingScore,
                growthScore: report.growthScore,
                consistencyScore: report.consistencyScore,
                deltas: JSON.parse(report.deltas),
                recommendations: JSON.parse(report.recommendations),
                createdAt: report.createdAt.toISOString(),
              }
            : null
        }
        runCount={snapshotCount}
      />
    </main>
  );
}
