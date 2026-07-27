import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute, parseBody } from "@/lib/api";
import { getLinkPage, updateLinkPage } from "@/lib/studio-growth";

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok({ page: await getLinkPage(session.id) });
});

const patchSchema = z
  .object({
    handle: z.string().trim().min(2).max(30).optional(),
    title: z.string().max(80).optional(),
    bio: z.string().max(500).optional(),
    theme: z.enum(["brand", "accent", "success", "warning", "brand-2"]).optional(),
    links: z.array(z.object({ label: z.string().max(60), url: z.string().max(500) })).max(30).optional(),
    published: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const res = await updateLinkPage(session.id, body.data);
  if (!res.ok) return fail(res.error, 422);
  return ok({ page: res.page });
});
