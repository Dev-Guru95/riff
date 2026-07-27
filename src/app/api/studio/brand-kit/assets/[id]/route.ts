import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { deleteBrandAsset } from "@/lib/studio-tools";

// DELETE /api/studio/brand-kit/assets/[id] — remove a brand asset (owner only).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteBrandAsset(session.id, id))) return fail("Asset not found", 404);
  return ok({ ok: true });
});
