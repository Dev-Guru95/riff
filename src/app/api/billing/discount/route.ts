import { z } from "zod";
import { getSession } from "@/lib/auth";
import { quoteCoupon } from "@/lib/coupons";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  plan: z.enum(["pro", "premium"]),
  code: z.string().min(1).max(64),
});

/**
 * POST /api/billing/discount — what does this code do to this plan?
 *
 * Read-only: it records nothing and grants nothing, so the Apply button can be
 * pressed as often as the artist likes. The response is the server's own
 * arithmetic over the server's own prices — the client never sends an amount,
 * and `finalCents` here is the only number the redeem and checkout endpoints
 * will honour.
 *
 * Available to the app as well as the website. Quoting a price is not a
 * purchasing mechanism; taking payment is, and that still lives on the web.
 */
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  // Codes are short and guessable by brute force, so the attempt rate is
  // capped per artist and per IP.
  const rl = rateLimit(`discount:${session.id}:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const result = await quoteCoupon(session.id, body.data.code, body.data.plan);
  if (!result.ok) return fail(result.message, result.status, { reason: result.reason });

  return ok({ discount: result.quote });
});
