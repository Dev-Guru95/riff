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

const money = z.number().int().min(0).max(1_000_000_00);

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("merch"),
    name: z.string().trim().min(1).max(120),
    // Optional starting figures, so "start from a template" and "add this AI
    // concept" create an item that already has a real margin on it. All
    // clamped server-side; the client never decides what gets stored.
    cost: money.optional(),
    price: money.optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    notes: z.string().max(2000).optional(),
    status: z.enum(["idea", "design", "production", "for_sale", "sold_out"]).optional(),
  }),
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
  if (body.data.type === "gig") {
    return ok({ id: await addGig(session.id, body.data.venue) }, 201);
  }
  const { type: _type, name, ...seed } = body.data;
  void _type;
  const id = await addMerch(session.id, name, seed);
  return ok({ id }, 201);
});
