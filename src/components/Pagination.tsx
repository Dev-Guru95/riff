import Link from "next/link";

/** Link-based pager for server components. Preserves other query params. */
export function Pagination({
  basePath,
  page,
  hasNext,
  params = {},
}: {
  basePath: string;
  page: number;
  hasNext: boolean;
  params?: Record<string, string | undefined>;
}) {
  if (page <= 1 && !hasNext) return null;
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between mt-4">
      {page > 1 ? (
        <Link href={qs(page - 1)} className="btn btn-ghost py-1.5 px-4 text-sm">← Prev</Link>
      ) : (
        <span className="opacity-30 btn btn-ghost py-1.5 px-4 text-sm pointer-events-none">← Prev</span>
      )}
      <span className="text-xs text-[var(--muted)]">Page {page}</span>
      {hasNext ? (
        <Link href={qs(page + 1)} className="btn btn-ghost py-1.5 px-4 text-sm">Next →</Link>
      ) : (
        <span className="opacity-30 btn btn-ghost py-1.5 px-4 text-sm pointer-events-none">Next →</span>
      )}
    </div>
  );
}
