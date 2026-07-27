import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { loadBoardActivity } from "@/lib/boards";

// GET /api/boards/[id]/activity — recent activity across the board. Member-scoped.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const activity = await loadBoardActivity(id, session.id);
  if (activity === null) return fail("Board not found", 404);
  return ok({ activity });
});
