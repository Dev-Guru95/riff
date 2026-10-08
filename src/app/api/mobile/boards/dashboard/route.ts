import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { loadDashboard } from "@/lib/boards";

// GET /api/mobile/boards/dashboard — the "my tasks" panel on src/app/(app)/boards/page.tsx
// (due today / overdue / upcoming, board progress, workload). Returns DashboardDTO.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok(await loadDashboard(session.id));
});
