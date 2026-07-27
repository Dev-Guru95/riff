import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { deleteFinance } from "@/lib/studio-tools";

// DELETE /api/studio/finance/[id] — remove a ledger entry (owner only).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteFinance(session.id, id))) return fail("Entry not found", 404);
  return ok({ ok: true });
});
