import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { listArchivedCards } from "@/lib/boards";

// GET /api/boards/[id]/archive — list archived cards (restore via PATCH card archived:false). Member-scoped.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const cards = await listArchivedCards(id, session.id);
  if (cards === null) return fail("Board not found", 404);
  return ok({ cards });
});
