import { z } from "zod";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { issueLeaderboardRewards } from "@/lib/rewards";
import { parseBody, ok, withRoute } from "@/lib/api";

const schema = z.object({ topN: z.number().int().min(1).max(10000).default(1000), code: z.string().default("TOP1000") });

export const POST = withRoute(async (req: Request) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const result = await issueLeaderboardRewards(body.data.topN, body.data.code);
  await writeAudit(session.id, "rewards.issue", "leaderboard", undefined, result);
  return ok(result);
});
