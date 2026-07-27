import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { getDraft, updateDraft, deleteDraft } from "@/lib/studio";

// GET /api/studio/drafts/[id] — one draft (owner only).
export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const draft = await getDraft(id, session.id);
  if (!draft) return fail("Draft not found", 404);
  return ok({ draft });
});

const patchSchema = z
  .object({ title: z.string().trim().max(120).optional(), content: z.string().max(20000).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/studio/drafts/[id] — save title/content (owner only).
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const draft = await updateDraft(id, session.id, body.data);
  if (!draft) return fail("Draft not found", 404);
  return ok({ draft });
});

// DELETE /api/studio/drafts/[id] — remove a draft (owner only).
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteDraft(id, session.id))) return fail("Draft not found", 404);
  return ok({ ok: true });
});
