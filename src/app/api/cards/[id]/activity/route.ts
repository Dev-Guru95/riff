import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { loadCardActivity } from "@/lib/boards";

// GET /api/cards/[id]/activity — recent activity for a card. Member-scoped.
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const activity = await loadCardActivity(id, session.id);
  if (activity === null) return fail("Card not found", 404);
  return ok({ activity });
});
