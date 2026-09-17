import Link from "next/link";
import { prisma, ci } from "@/lib/prisma";
import { Pagination } from "@/components/Pagination";
import { PageHeader, TableCard, Avatar, EmptyState, Chip } from "@/components/ui";
import { Icon } from "@/components/icons";
import { UserActions } from "./UsersClient";

const PAGE_SIZE = 50;

// Column template shared by the header and every row so the two stay aligned.
// The Actions track must fit two selects plus two pill buttons side by side —
// at anything under ~21rem they overflow the track and cover the Streak value.
const COLS = "grid-cols-[1fr_5rem_5rem_3.5rem_3rem_3rem_4.5rem_21rem]";
const TABLE_MIN = "min-w-[62rem]";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pending?: string }> }) {
  const { q, page: pageParam, pending } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const pendingOnly = pending === "1";
  const where = {
    ...(q ? { email: ci(q) } : {}),
    ...(pendingOnly ? { skoolRequestedAt: { not: null }, skoolMember: false } : {}),
  };
  const [users, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: pendingOnly ? { skoolRequestedAt: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: {
        profile: { select: { stageName: true } },
        level: { select: { totalXp: true } },
        // Riff-side progress, so a Skool admin can judge whether an artist is
        // actually working the program before changing their tier or access.
        subscription: { select: { plan: true, status: true } },
        streak: { select: { currentLen: true } },
        _count: { select: { badges: true } },
        enrollments: { select: { completedAt: true } },
      },
      // skoolMember / skoolRequestedAt are scalars — returned implicitly with the row.
    }),
    prisma.user.count({ where: { skoolRequestedAt: { not: null }, skoolMember: false } }),
  ]);
  const hasNext = users.length > PAGE_SIZE;
  const pageUsers = users.slice(0, PAGE_SIZE);

  return (
    // 6xl, not 5xl: the 8-column table needs 62rem, and a 5xl container left it
    // 33px short — enough to force a horizontal scrollbar on every desktop.
    <div className="max-w-6xl">
      <PageHeader title="Users" subtitle="Everyone with a Riff account, and the access they hold" />

      {/* Community access requests awaiting admin verification */}
      {pendingCount > 0 && (
        <Link
          href={pendingOnly ? "/admin/users" : "/admin/users?pending=1"}
          className="card p-4 flex items-center justify-between gap-3 hover:border-[var(--brand)] transition mb-4"
        >
          <span className="text-sm">
            <strong>{pendingCount}</strong> community access request{pendingCount === 1 ? "" : "s"} awaiting verification
          </span>
          <span className="text-xs text-[var(--brand)] flex items-center gap-1 shrink-0">
            {pendingOnly ? "Show all users" : "Review"} <Icon name="chevronRight" size={13} />
          </span>
        </Link>
      )}

      <form className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search by email…" className="field flex-1" />
        {pendingOnly && <input type="hidden" name="pending" value="1" />}
        <button className="btn btn-ghost shrink-0">Search</button>
      </form>

      <TableCard>
        <div className="overflow-x-auto">
          <div className={TABLE_MIN}>
            <div className={`grid ${COLS} gap-2 px-4 py-2.5 text-xs font-medium text-[var(--muted)] border-b border-[var(--border)]`}>
              <span>User</span>
              <span>Role</span>
              <span>Tier</span>
              <span className="text-right">XP</span>
              <span className="text-right" title="Tracks completed">Trk</span>
              <span className="text-right" title="Badges earned">Bdg</span>
              <span className="text-right" title="Current day streak">Streak</span>
              <span className="text-right">Actions</span>
            </div>
            {pageUsers.map((u) => {
              const plan = u.subscription?.plan ?? "free";
              const name = u.profile?.stageName ?? u.email.split("@")[0];
              const tracksDone = u.enrollments.filter((e) => e.completedAt !== null).length;
              return (
                <div
                  key={u.id}
                  className={`grid ${COLS} gap-2 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 items-center hover:bg-[var(--surface-2)]/40 transition`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={name} size={32} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-[var(--muted)] truncate">{u.email}</div>
                      <div className="text-xs flex items-center gap-1.5">
                        <span className={u.status === "active" ? "text-[var(--success)]" : "text-[var(--brand-2)]"}>
                          {u.status}
                        </span>
                        {u.skoolMember && <Chip tone="brand">Skool</Chip>}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{u.role}</span>
                  <span className={`text-xs font-medium ${plan === "free" ? "text-[var(--muted)]" : "text-[var(--brand)]"}`}>
                    {plan}
                  </span>
                  <span className="text-right tabular-nums">{u.level?.totalXp ?? 0}</span>
                  <span className="text-right tabular-nums">{tracksDone}</span>
                  <span className="text-right tabular-nums">{u._count.badges}</span>
                  <span className="text-right tabular-nums">{u.streak?.currentLen ?? 0}</span>
                  <div className="text-right">
                    <UserActions
                      id={u.id}
                      status={u.status}
                      role={u.role}
                      plan={plan}
                      skoolMember={u.skoolMember}
                      requested={!!u.skoolRequestedAt}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {pageUsers.length === 0 && <EmptyState icon="user" title="No users found." />}
      </TableCard>

      <Pagination basePath="/admin/users" page={page} hasNext={hasNext} params={{ q }} />
    </div>
  );
}
