import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildCoachContext, generateRoadmap } from "@/lib/ai-coach";
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
