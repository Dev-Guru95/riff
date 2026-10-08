import { prisma, ci } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import { pageParam } from "@/lib/mobile/server";
import type { AdminUsersResponse } from "@/lib/mobile/types";

const PAGE_SIZE = 50;

// GET /api/mobile/admin/users?q=&page=&pending=1 — src/app/(admin)/admin/users/page.tsx.
// Staff only. Explicit select (the page uses `include`, which would carry
// passwordHash / mfaSecret). Edit with PATCH /api/admin/users/[id] (admin only).
export const GET = withRoute(async (req: Request) => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") || null;
  const page = pageParam(sp.get("page"));
  const pendingOnly = sp.get("pending") === "1";
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
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        skoolMember: true,
        skoolRequestedAt: true,
        skoolHandle: true,
        profile: { select: { stageName: true } },
        level: { select: { totalXp: true } },
        subscription: { select: { plan: true, status: true } },
        streak: { select: { currentLen: true } },
        _count: { select: { badges: true } },
        enrollments: { select: { completedAt: true } },
      },
    }),
    prisma.user.count({ where: { skoolRequestedAt: { not: null }, skoolMember: false } }),
  ]);

  const body: AdminUsersResponse = {
    q,
    pendingOnly,
    page,
    pageSize: PAGE_SIZE,
    hasNext: users.length > PAGE_SIZE,
    pendingCount,
    users: users.slice(0, PAGE_SIZE).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.profile?.stageName ?? u.email.split("@")[0],
      stageName: u.profile?.stageName ?? null,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      plan: u.subscription?.plan ?? "free",
      subscriptionStatus: u.subscription?.status ?? null,
      totalXp: u.level?.totalXp ?? 0,
      tracksDone: u.enrollments.filter((e) => e.completedAt !== null).length,
      badgeCount: u._count.badges,
      streak: u.streak?.currentLen ?? 0,
      skoolMember: u.skoolMember,
      skoolRequestedAt: u.skoolRequestedAt?.toISOString() ?? null,
      skoolHandle: u.skoolHandle,
    })),
  };
  return ok(body);
});
