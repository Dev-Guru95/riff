import { prisma } from "@/lib/prisma";
import { ContentDecision } from "./ContentClient";

export default async function AdminContent() {
  const suggestions = await prisma.contentSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const pending = suggestions.filter((s) => s.status === "pending");
  const resolved = suggestions.filter((s) => s.status !== "pending");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Content Suggestions</h1>
        <p className="text-sm text-[var(--muted)]">AI proposes content updates from industry trends. Approve to apply (bumps course version), or reject.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">Pending ({pending.length})</h2>
        {pending.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)]">{s.targetType}</span>
              <span className="font-medium">{s.title}</span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-2">{s.rationale}</p>
            {safeUrls(s.sourceUrls).map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] block">{u}</a>
            ))}
            <div className="mt-3"><ContentDecision id={s.id} /></div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-[var(--muted)] text-sm">No pending suggestions.</p>}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">Resolved</h2>
          {resolved.map((s) => (
            <div key={s.id} className="card px-4 py-3 flex items-center justify-between text-sm">
              <span>{s.title}</span>
              <span className={s.status === "approved" ? "text-[var(--success)]" : "text-[var(--brand-2)]"}>{s.status}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function safeUrls(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}
