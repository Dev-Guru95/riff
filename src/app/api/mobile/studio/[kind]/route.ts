import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { builderFor, listDrafts } from "@/lib/studio";
import type { StudioBuilderResponse } from "@/lib/mobile/types";

// GET /api/mobile/studio/[kind] — src/app/(app)/studio/[kind]/page.tsx
// (builder metadata + the artist's drafts for it).
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ kind: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { kind } = await params;

  const builder = builderFor(kind);
  if (!builder) return fail("Builder not found", 404);

  const body: StudioBuilderResponse = { builder, drafts: await listDrafts(session.id, kind) };
  return ok(body);
});
