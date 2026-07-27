import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { updateMerch, deleteMerch } from "@/lib/studio-tools";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["idea", "design", "production", "for_sale", "sold_out"]).optional(),
    cost: z.number().int().min(0).max(1_000_000_00).optional(),
    price: z.number().int().min(0).max(1_000_000_00).optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/studio/merch/[id] — edit a merch item (owner only).
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  if (!(await updateMerch(session.id, id, body.data))) return fail("Item not found", 404);
  return ok({ ok: true });
});

// DELETE /api/studio/merch/[id]
export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteMerch(session.id, id))) return fail("Item not found", 404);
  return ok({ ok: true });
});
