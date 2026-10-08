import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import type { AdminModerationResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/moderation?status=open|dismissed|resolved|all —
// src/app/(admin)/admin/moderation/page.tsx (latest 100, with content previews).
// Staff only. Act with PATCH /api/admin/reports/[id] (moderator or admin).
export const GET = withRoute(async (req: Request) => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const filter = new URL(req.url).searchParams.get("status") ?? "open";
  const reports = await prisma.report.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const enriched = await Promise.all(
    reports.map(async (r) => {
      let preview: string;
      if (r.targetType === "post") {
        preview = (await prisma.post.findUnique({ where: { id: r.targetId }, select: { body: true } }))?.body ?? "(deleted)";
      } else if (r.targetType === "thread") {
        preview = (await prisma.thread.findUnique({ where: { id: r.targetId }, select: { title: true } }))?.title ?? "(deleted)";
      } else {
        preview = (await prisma.user.findUnique({ where: { id: r.targetId }, select: { email: true } }))?.email ?? "(deleted)";
      }
      return {
        id: r.id,
        reporterId: r.reporterId,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        reviewedById: r.reviewedById,
        createdAt: r.createdAt.toISOString(),
        preview,
      };
    }),
  );

  const body: AdminModerationResponse = { status: filter, reports: enriched };
  return ok(body);
});
