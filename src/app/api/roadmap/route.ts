import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildCoachContext, generateRoadmap } from "@/lib/ai-coach";
import { getEntitlements } from "@/lib/entitlements";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({ horizon: z.enum(["30d", "90d", "6m", "12m"]) });

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`ai:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  // The Plans page has always sold the "full roadmap" — every horizon from 30
  // days to 12 months — as a Pro feature, but nothing checked it, so Free
  // accounts could generate 12-month plans. Enforcing the gate that was
  // already advertised. Roadmaps generated before this still read fine; only
  // generating a *new* long-horizon plan needs Pro.
  const { roadmapHorizons, plan: userPlan } = await getEntitlements(session.id);
  if (!(roadmapHorizons as readonly string[]).includes(body.data.horizon)) {
    return fail(
      "Longer-range roadmaps are a Pro feature. Your 30-day plan is always free — upgrade to plan 90 days, 6 months and a year ahead.",
      403,
      { reason: "upgrade_required", plan: userPlan, allowed: roadmapHorizons },
    );
  }

  const ctx = await buildCoachContext(session.id);
  const plan = await generateRoadmap(ctx, body.data.horizon);

  // Supersede the previous current roadmap for this horizon.
  await prisma.roadmap.updateMany({
    where: { userId: session.id, horizon: body.data.horizon, isCurrent: true },
    data: { isCurrent: false },
  });
  const roadmap = await prisma.roadmap.create({
    data: {
      userId: session.id,
      horizon: body.data.horizon,
      plan: JSON.stringify(plan),
      generatedFrom: JSON.stringify({ genres: ctx.genres, careerStage: ctx.careerStage, audienceSize: ctx.audienceSize, totalXp: ctx.totalXp }),
      isCurrent: true,
    },
  });

  return ok({ id: roadmap.id, horizon: roadmap.horizon, plan });
});
