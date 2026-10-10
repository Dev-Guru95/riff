import { getSession } from "@/lib/auth";
import { completeMission } from "@/lib/missions";
import { ok, fail, withRoute } from "@/lib/api";

export const POST = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;

  const result = await completeMission(session.id, id);
  if ("error" in result && result.error) return fail(result.error, 400);
  return ok({ xp: result.xp, streak: result.streak });
});
