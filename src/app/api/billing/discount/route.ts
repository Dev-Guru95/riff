import { z } from "zod";
import { getSession } from "@/lib/auth";
import { quoteCoupon, campaignDiscount } from "@/lib/coupons";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  plan: z.literal("pro"),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
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

  const { plan, interval } = body.data;
  const result = await quoteCoupon(session.id, body.data.code, plan, interval);
  if (!result.ok) return fail(result.message, result.status, { reason: result.reason });

  // The BFCM launch offer and a code do not stack: checkout applies whichever
  // is worth more (see /api/billing/checkout). Returning the comparison means
  // the UI can say so *before* the artist pays, rather than leaving them to
  // wonder why their code seemingly did nothing.
  const campaign = campaignDiscount(plan, interval);
  const campaignWins = !!campaign && !result.quote.free && campaign.discountCents > result.quote.discountCents;

  return ok({
    discount: result.quote,
    campaign,
    /** True when the launch offer beats this code, so the offer is what gets applied. */
    campaignWins,
  });
});
