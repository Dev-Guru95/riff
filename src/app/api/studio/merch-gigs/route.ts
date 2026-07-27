import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listMerchAndGigs, addMerch, addGig } from "@/lib/studio-tools";

// GET /api/studio/merch-gigs — the user's merch items + gigs.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok(await listMerchAndGigs(session.id));
});

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("merch"), name: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal("gig"), venue: z.string().trim().min(1).max(120) }),
]);

// POST /api/studio/merch-gigs — add a merch item or a gig.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`merch:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const id = body.data.type === "merch" ? await addMerch(session.id, body.data.name) : await addGig(session.id, body.data.venue);
  return ok({ id }, 201);
});
