import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { updateBooking, deleteBooking } from "@/lib/studio-growth";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    contact: z.string().max(160).optional(),
    date: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
    status: z.enum(["inquiry", "held", "confirmed", "done", "declined"]).optional(),
    fee: z.number().int().min(0).max(1_000_000_00).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const date = body.data.date === "" ? null : body.data.date;
  if (!(await updateBooking(session.id, id, { ...body.data, date }))) return fail("Booking not found", 404);
  return ok({ ok: true });
});

export const DELETE = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  if (!(await deleteBooking(session.id, id))) return fail("Booking not found", 404);
  return ok({ ok: true });
});
