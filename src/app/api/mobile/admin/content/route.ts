import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import { parseJson, parseJsonArray } from "@/lib/mobile/server";
import type { AdminContentResponse, AdminContentSuggestion } from "@/lib/mobile/types";

// GET /api/mobile/admin/content — src/app/(admin)/admin/content/page.tsx
// (latest 50 AI content suggestions, split pending / resolved). Staff only.
// Decide with PATCH /api/admin/content-suggestions/[id] (admin only).
export const GET = withRoute(async () => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const rows = await prisma.contentSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const suggestions: AdminContentSuggestion[] = rows.map((s) => ({
    id: s.id,
    targetType: s.targetType,
    targetId: s.targetId,
    title: s.title,
    rationale: s.rationale,
    suggested: parseJson<unknown>(s.suggested, {}),
    sourceUrls: parseJsonArray<string>(s.sourceUrls).map(String),
    status: s.status,
    reviewedById: s.reviewedById,
    createdAt: s.createdAt.toISOString(),
  }));

  const body: AdminContentResponse = {
    pending: suggestions.filter((s) => s.status === "pending"),
    resolved: suggestions.filter((s) => s.status !== "pending"),
  };
  return ok(body);
});
