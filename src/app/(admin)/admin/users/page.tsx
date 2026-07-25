import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/Pagination";
import { UserActions } from "./UsersClient";

const PAGE_SIZE = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pending?: string }> }) {
  const { q, page: pageParam, pending } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const pendingOnly = pending === "1";
  const where = {
    ...(q ? { email: { contains: q } } : {}),
    ...(pendingOnly ? { skoolRequestedAt: { not: null }, skoolMember: false } : {}),
  };
  const [users, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: pendingOnly ? { skoolRequestedAt: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { profile: { select: { stageName: true } }, level: { select: { totalXp: true } } },
      // skoolMember / skoolRequestedAt are scalars — returned implicitly with the row.
    }),
    prisma.user.count({ where: { skoolRequestedAt: { not: null }, skoolMember: false } }),
  ]);
  const hasNext = users.length > PAGE_SIZE;
  const pageUsers = users.slice(0, PAGE_SIZE);

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Users</h1>

      {/* Community access requests awaiting admin verification */}
      {pendingCount > 0 && (
        <Link
          href={pendingOnly ? "/admin/users" : "/admin/users?pending=1"}
          className="card p-4 flex items-center justify-between hover:border-[var(--brand)] transition"
        >
          <span className="text-sm">
            ⏳ <strong>{pendingCount}</strong> community access request{pendingCount === 1 ? "" : "s"} awaiting verification
          </span>
          <span className="text-xs text-[var(--brand)]">{pendingOnly ? "Show all users" : "Review →"}</span>
        </Link>
      )}

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by email…" className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
        {pendingOnly && <input type="hidden" name="pending" value="1" />}
        <button className="btn btn-ghost">Search</button>
      </form>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_6rem_4rem_5rem_13rem] gap-2 px-4 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
          <span>User</span><span>Role</span><span className="text-right">XP</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {pageUsers.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_6rem_4rem_5rem_13rem] gap-2 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 items-center">
            <div className="truncate">
              <div className="font-medium truncate">{u.profile?.stageName ?? u.email.split("@")[0]}</div>
              <div className="text-xs text-[var(--muted)] truncate">{u.email}</div>
            </div>
            <span className="text-xs">{u.role}</span>
            <span className="text-right">{u.level?.totalXp ?? 0}</span>
            <span className={`text-xs ${u.status === "active" ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>{u.status}</span>
            <div className="text-right"><UserActions id={u.id} status={u.status} role={u.role} skoolMember={u.skoolMember} requested={!!u.skoolRequestedAt} /></div>
          </div>
        ))}
        {pageUsers.length === 0 && <div className="px-4 py-6 text-center text-[var(--muted)] text-sm">No users found.</div>}
      </div>
      <Pagination basePath="/admin/users" page={page} hasNext={hasNext} params={{ q }} />
    </div>
  );
}
