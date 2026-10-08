import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import { parseJsonArray } from "@/lib/mobile/server";
import type { AdminSubmissionsResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/submissions?status=flagged|reviewed|all — the review
// queue from src/app/(admin)/admin/submissions/page.tsx (latest 50). Staff only.
// Override with PATCH /api/admin/submissions/[id] (reviewer or admin).
export const GET = withRoute(async (req: Request) => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const filter = new URL(req.url).searchParams.get("status") ?? "flagged";
  const submissions = await prisma.submission.findMany({
    where: filter === "all" ? {} : { status: filter },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { assignment: { select: { title: true, minPassingScore: true } }, user: { select: { email: true } } },
  });

  const body: AdminSubmissionsResponse = {
    status: filter,
    submissions: submissions.map((s) => ({
      id: s.id,
      status: s.status,
      artifactType: s.artifactType,
      textContent: s.textContent,
      externalLink: s.externalLink,
      artifactUrls: parseJsonArray<string>(s.artifactUrls).map(String),
      aiScore: s.aiScore,
      confidence: s.confidence,
      humanReviewed: s.humanReviewed,
      createdAt: s.createdAt.toISOString(),
      assignment: s.assignment,
      user: s.user,
    })),
  };
  return ok(body);
});
