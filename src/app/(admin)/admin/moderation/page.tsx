import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, Chip } from "@/components/ui";
import { ReportActions } from "./ModerationClient";

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status ?? "open";
  const reports = await prisma.report.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve reporter + a content preview per report.
  const enriched = await Promise.all(
    reports.map(async (r) => {
      let preview = "";
      if (r.targetType === "post") preview = (await prisma.post.findUnique({ where: { id: r.targetId } }))?.body ?? "(deleted)";
      else if (r.targetType === "thread") preview = (await prisma.thread.findUnique({ where: { id: r.targetId } }))?.title ?? "(deleted)";
      else preview = (await prisma.user.findUnique({ where: { id: r.targetId } }))?.email ?? "(deleted)";
      return { ...r, preview };
    }),
  );

  const tabs = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "dismissed", label: "Dismissed" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Moderation" subtitle="Reported threads, posts, and users." />

      <div className="flex gap-1 mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/admin/moderation?status=${t.key}`}
            className={`pill ${filter === t.key ? "pill-active" : ""}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {enriched.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="text-sm font-semibold mb-3">Reason: {r.reason}</div>
            <div className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--muted)] mb-4">
              {r.preview}
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {r.status === "open" ? (
                <ReportActions id={r.id} />
              ) : (
                <span className="text-xs text-[var(--muted)] capitalize">{r.status}</span>
              )}
              <div className="flex items-center gap-2 shrink-0">
                <Chip>{r.targetType}</Chip>
                <span className="text-xs text-[var(--muted)]">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
        {enriched.length === 0 && (
          <EmptyState title="Howdy! Nothing to see here." hint="No reports match this filter." />
        )}
      </div>
    </div>
  );
}
