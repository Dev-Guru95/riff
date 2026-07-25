import { prisma } from "@/lib/prisma";
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
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Moderation</h1>
      <p className="text-sm text-[var(--muted)]">Reported threads, posts, and users. Resolve, dismiss, or remove content.</p>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <a key={t.key} href={`/admin/moderation?status=${t.key}`} className={`text-sm px-3 py-1.5 rounded-lg ${filter === t.key ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {enriched.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)]">{r.targetType}</span>
              <span className="text-xs text-[var(--muted)]">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-sm font-medium">Reason: {r.reason}</div>
            <div className="text-sm bg-[var(--surface-2)] rounded-lg p-2 my-2 text-[var(--muted)]">{r.preview}</div>
            {r.status === "open" ? <ReportActions id={r.id} /> : <span className="text-xs text-[var(--muted)]">{r.status}</span>}
          </div>
        ))}
        {enriched.length === 0 && <p className="text-[var(--muted)] text-sm">Nothing here. 🎉</p>}
      </div>
    </div>
  );
}
