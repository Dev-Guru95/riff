import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { recordMerchSale, recordMerchRunCost } from "@/lib/studio-tools";

const schema = z.object({
  /** "sale" takes stock off the shelf and books the income. */
  kind: z.enum(["sale", "run_cost"]).default("sale"),
  units: z.number().int().min(1).max(100_000).default(1),
});

const SALE_ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: "Item not found", status: 404 },
  unpriced: { message: "Set a retail price before logging a sale.", status: 409 },
  no_stock: { message: "No stock left to sell. Add stock or restock the item first.", status: 409 },
  no_cost: { message: "Set a unit cost before logging what the run cost you.", status: 409 },
};

/**
 * POST /api/studio/merch/[id]/sale — move merch money into the ledger.
 *
 * `sale` books income and drops the stock; `run_cost` books the one-off
 * production expense. Both write a real FinanceEntry, which is what makes the
 * Revenue & Budget screen reflect merch instead of ignoring it.
 */
export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`merch:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const result =
    body.data.kind === "sale"
      ? await recordMerchSale(session.id, id, body.data.units)
      : await recordMerchRunCost(session.id, id, body.data.units);

  if ("error" in result) {
    const e = SALE_ERRORS[result.error] ?? { message: "Could not log that.", status: 400 };
    return fail(e.message, e.status, { reason: result.error });
  }

  return ok(result);
});
