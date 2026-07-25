import { z } from "zod";
import { getSession } from "@/lib/auth";
import { requestCommunityAccess } from "@/lib/community";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ handle: z.string().max(60).optional() });

// Request community access. This does NOT grant access — an admin must verify
// before Community + AI Coach unlock. Records a pending request the admin sees.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  await requestCommunityAccess(session.id, body.data.handle);
  return ok({ requested: true });
});
