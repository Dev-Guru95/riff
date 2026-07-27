import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { updateFan, deleteFan } from "@/lib/studio-growth";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().email().or(z.literal("")).optional(),
    location: z.string().max(120).optional(),
    tags: z.array(z.string().max(30)).max(30).optional(),
    source: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  if (!(await updateFan(session.id, id, body.data))) return fail("Fan not found", 404);
  return ok({ ok: true });
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteFan(session.id, id))) return fail("Fan not found", 404);
  return ok({ ok: true });
});
