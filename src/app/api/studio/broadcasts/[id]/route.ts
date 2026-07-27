import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { updateBroadcast, deleteBroadcast } from "@/lib/studio-growth";

const patchSchema = z
  .object({
    subject: z.string().trim().min(1).max(160).optional(),
    body: z.string().max(20000).optional(),
    segment: z.string().max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  if (!(await updateBroadcast(session.id, id, body.data))) return fail("Broadcast not found or already sent", 404);
  return ok({ ok: true });
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteBroadcast(session.id, id))) return fail("Broadcast not found", 404);
  return ok({ ok: true });
});
