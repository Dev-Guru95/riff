import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { updateGoal, deleteGoal } from "@/lib/studio-growth";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    detail: z.string().max(2000).optional(),
    targetDate: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    milestones: z.array(z.object({ text: z.string().max(200), done: z.boolean() })).max(50).optional(),
    status: z.enum(["active", "done", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const date = body.data.targetDate === "" ? null : body.data.targetDate;
  if (!(await updateGoal(session.id, id, { ...body.data, targetDate: date }))) return fail("Goal not found", 404);
  return ok({ ok: true });
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteGoal(session.id, id))) return fail("Goal not found", 404);
  return ok({ ok: true });
});
