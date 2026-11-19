import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { merchPlanQuota } from "@/lib/entitlements";
import { buildCoachContext } from "@/lib/ai-coach";
import { merchPlan } from "@/lib/merch";

const schema = z.object({
  brief: z.string().trim().max(500).optional(),
  /** First-run budget in minor units. 0 / absent means "not stated". */
  budgetCents: z.number().int().min(0).max(100_000_00).optional(),
  /** Ask for the week-by-week launch campaign too (Premium). */
  campaign: z.boolean().default(false),
});

/**
 * POST /api/studio/merch-plan — AI merch concepts for this artist.
 *
 * A paid feature, and the gate is here rather than in the UI: the Plans page
 * sells "AI merch concepts" as Pro with a higher daily allowance on Premium,
 * and the launch campaign as Premium only, so this endpoint is what makes
 * those three claims true.
 *
 * Deliberately *not* at /api/studio/merch/plan — that path sits under the
 * `[id]` segment and would only work by relying on Next preferring a static
 * segment over a dynamic one.
 */
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  // Two limits, for two different reasons: the burst limit protects the AI
  // spend, the daily quota is the thing the plan actually sells.
  const rl = rateLimit(`ai:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const quota = await merchPlanQuota(session.id);
  if (quota.limit <= 0) {
    return fail(
      "AI merch concepts are a Pro feature. The planner, margins and sales logging are free — upgrade to have the ideas and pricing generated for you.",
      403,
      { reason: "upgrade_required", plan: quota.plan },
    );
  }
  if (quota.remaining <= 0) {
    return fail(
      `You've used all ${quota.limit} AI merch plans for today. They reset at midnight.`,
      429,
      { reason: "quota_exhausted", plan: quota.plan, limit: quota.limit, used: quota.used },
    );
  }

  // The campaign is Premium-only. Asking for it on Pro quietly returns the
  // concepts without it rather than failing the whole request — the UI shows
  // Pro what it is missing instead of a dead end.
  const wantsCampaign = body.data.campaign && quota.campaigns;

  const ctx = await buildCoachContext(session.id);
  const existing = await prisma.merchItem.findMany({
    where: { userId: session.id },
    select: { name: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const plan = await merchPlan(
    ctx,
    {
      brief: body.data.brief,
      budgetCents: body.data.budgetCents ?? 0,
      existing: existing.map((e) => e.name),
    },
    // Two separate entitlements, not one: `extended` is the depth of every
    // plan the AI writes, `campaign` is whether it also writes the launch
    // schedule. Reading the campaign flag for both happened to agree today
    // and would quietly diverge the moment a tier changed.
    { extended: quota.extended, campaign: wantsCampaign },
  );

  // The quota is counted from these events (see merchPlanQuota), so this write
  // is what makes the allowance real. Recorded after a successful generation:
  // a failed AI call should not cost the artist one of their plans.
  await prisma.analyticsEvent
    .create({
      data: {
        userId: session.id,
        type: "merch_plan",
        meta: JSON.stringify({ plan: quota.plan, campaign: wantsCampaign, concepts: plan.concepts.length }),
      },
    })
    .catch(() => {});

  return ok({
    plan,
    quota: { limit: quota.limit, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) },
    campaignAvailable: quota.campaigns,
  });
});
