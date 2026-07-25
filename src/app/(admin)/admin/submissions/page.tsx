import { prisma } from "@/lib/prisma";
import { OverrideForm } from "./ReviewClient";

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status ?? "flagged";
  const where = filter === "all" ? {} : { status: filter };

  const submissions = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { assignment: { select: { title: true, minPassingScore: true } }, user: { select: { email: true } } },
  });

  const tabs = [
    { key: "flagged", label: "Flagged" },
    { key: "reviewed", label: "Reviewed" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Review Queue</h1>
      <p className="text-sm text-[var(--muted)]">Low-confidence AI reviews are flagged here for a human to confirm or override.</p>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <a key={t.key} href={`/admin/submissions?status=${t.key}`} className={`text-sm px-3 py-1.5 rounded-lg ${filter === t.key ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--muted)]"}`}>
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {submissions.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium">{s.assignment.title}</div>
                <div className="text-xs text-[var(--muted)]">{s.user.email} · {new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{s.aiScore ?? "—"}</div>
                <div className="text-xs text-[var(--muted)]">
                  conf {s.confidence != null ? Math.round(s.confidence * 100) : "—"}% · {s.status}
                </div>
              </div>
            </div>
            {(s.textContent || s.externalLink) && (
              <div className="text-sm bg-[var(--surface-2)] rounded-lg p-3 mb-3">
                {s.textContent && <p>{s.textContent}</p>}
                {s.externalLink && <a href={s.externalLink} className="text-[var(--accent)] text-xs" target="_blank" rel="noreferrer">{s.externalLink}</a>}
              </div>
            )}
            <OverrideForm id={s.id} currentScore={s.aiScore ?? 70} passMark={s.assignment.minPassingScore} alreadyReviewed={s.humanReviewed} />
          </div>
        ))}
        {submissions.length === 0 && <p className="text-[var(--muted)] text-sm">Nothing here. 🎉</p>}
      </div>
    </div>
  );
}
