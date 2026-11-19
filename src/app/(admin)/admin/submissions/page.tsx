import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { planFromSubscription } from "@/lib/entitlements";
import { planRank } from "@/lib/stripe";
import { OverrideForm } from "./ReviewClient";

const PAGE_SIZE = 50;

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status ?? "flagged";
  const where = filter === "all" ? {} : { status: filter };

  // "Priority in the human review queue" is sold as a Premium feature, so the
  // queue actually has to be ordered by plan. Prisma cannot sort by effective
  // plan (it depends on the subscription's status and period end as well as
  // its `plan` string), so a wider window is read and ordered here, then cut
  // to a page — cheap at admin scale, and the alternative is a feature that is
  // advertised and not delivered.
  const rows = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE * 4,
    include: {
      assignment: { select: { title: true, minPassingScore: true } },
      user: {
        select: {
          email: true,
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true, provider: true } },
        },
      },
    },
  });

  const submissions = rows
    .map((s) => ({ ...s, plan: planFromSubscription(s.user.subscription) }))
    .sort(
      (a, b) =>
        // Higher plan first, then oldest-waiting first within a plan so nobody
        // is starved by a newer submission from the same tier.
        planRank(b.plan) - planRank(a.plan) || a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .slice(0, PAGE_SIZE);

  const tabs = [
    { key: "all", label: "All" },
    { key: "reviewed", label: "Reviewed" },
    { key: "flagged", label: "Flagged" },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Review Queue"
        subtitle="Low confidence AI reviews are flagged here for a human to confirm or override. Premium artists are listed first — human review is part of what they pay for."
      />

      <div className="flex gap-1 mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/admin/submissions?status=${t.key}`}
            className={`pill ${filter === t.key ? "pill-active" : ""}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {submissions.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {s.assignment.title}
                  {s.plan !== "free" && (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        s.plan === "premium"
                          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "bg-[var(--brand)]/15 text-[var(--brand)]"
                      }`}
                    >
                      {s.plan}
                    </span>
                  )}
                </div>
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
              <div className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 mb-3">
                {s.textContent && <p>{s.textContent}</p>}
                {s.externalLink && <a href={s.externalLink} className="text-[var(--accent)] text-xs" target="_blank" rel="noreferrer">{s.externalLink}</a>}
              </div>
            )}
            <OverrideForm id={s.id} currentScore={s.aiScore ?? 70} passMark={s.assignment.minPassingScore} alreadyReviewed={s.humanReviewed} />
          </div>
        ))}
        {submissions.length === 0 && (
          <EmptyState title="Howdy! Nothing to see here." hint="No submissions match this filter." />
        )}
      </div>
    </div>
  );
}
