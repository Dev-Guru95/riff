import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { getBrandKit, updateBrandKit } from "@/lib/studio-tools";

// GET /api/studio/brand-kit — the user's brand kit (created on first access).
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok({ kit: await getBrandKit(session.id) });
});

const patchSchema = z
  .object({
    colors: z.array(z.object({ name: z.string().max(40), hex: z.string().regex(/^#[0-9a-fA-F]{3,8}$/) })).max(24).optional(),
    fonts: z.array(z.object({ name: z.string().max(60), usage: z.string().max(60) })).max(12).optional(),
    guidelines: z.string().max(20000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/studio/brand-kit — save palette / fonts / guidelines.
export const PATCH = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  await updateBrandKit(session.id, body.data);
  return ok({ kit: await getBrandKit(session.id) });
});
