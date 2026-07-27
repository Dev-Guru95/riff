import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listFinance, addFinance } from "@/lib/studio-tools";

// GET /api/studio/finance — ledger + totals for the current user.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  return ok(await listFinance(session.id));
});

const schema = z.object({
  kind: z.enum(["income", "expense"]),
  category: z.enum(["streaming", "merch", "shows", "ads", "gear", "other"]).default("other"),
  label: z.string().trim().min(1).max(120),
  amount: z.number().int().min(1).max(1_000_000_00), // cents, up to $1M
  date: z.union([z.string().datetime(), z.null()]).optional(),
});

// POST /api/studio/finance — add an income/expense entry.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`fin:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const id = await addFinance(session.id, body.data);
  return ok({ id }, 201);
});
