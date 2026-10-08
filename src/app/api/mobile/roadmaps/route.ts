import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { parseJson } from "@/lib/mobile/server";
import type { RoadmapHorizon, RoadmapPlan, RoadmapsResponse } from "@/lib/mobile/types";

// GET /api/mobile/roadmaps — src/app/(app)/roadmap/page.tsx. Generate a plan
// with POST /api/roadmap { horizon }.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const roadmaps = await prisma.roadmap.findMany({
    where: { userId: session.id, isCurrent: true },
    orderBy: { createdAt: "desc" },
  });

  // Same fold as the page (later rows overwrite earlier ones per horizon).
  const plans: RoadmapsResponse["plans"] = {};
  for (const r of roadmaps) {
    const plan = parseJson<RoadmapPlan | null>(r.plan, null);
    if (plan) plans[r.horizon as RoadmapHorizon] = plan;
  }

  const body: RoadmapsResponse = { plans };
  return ok(body);
});
