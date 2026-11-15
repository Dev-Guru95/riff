import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getMissionsForUser } from "@/lib/missions";
import { getEntitlements } from "@/lib/entitlements";
import type { MissionsResponse } from "@/lib/mobile/types";

// GET /api/mobile/missions — src/app/(app)/missions/page.tsx.
// SIDE EFFECT (same as the page): getMissionsForUser() creates this week's
// mission set on the first visit of the week.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [missions, { weeklyMissions }] = await Promise.all([
    getMissionsForUser(session.id),
    getEntitlements(session.id),
  ]);
  const body: MissionsResponse = {
    missions,
    completed: missions.filter((m) => m.status === "completed").length,
    total: missions.length,
    // Lets the app show the locked state instead of a button that 403s.
    weeklyMissions,
  };
  return ok(body);
});
