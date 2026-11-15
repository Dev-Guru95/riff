import { z } from "zod";
import { getSession } from "@/lib/auth";
import { completeMission, MISSION_PROOF_MAX } from "@/lib/missions";
import { getEntitlements } from "@/lib/entitlements";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ proof: z.string().min(1).max(MISSION_PROOF_MAX) });

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  // Weekly missions are a Pro feature — the Plans page has always said so. The
  // check lives here, not only in the UI, because the XP and badges a mission
  // awards are real and a hidden button is not a gate.
  const { weeklyMissions } = await getEntitlements(session.id);
  if (!weeklyMissions) {
    return fail("Weekly missions are part of Pro.", 403, { reason: "upgrade_required" });
  }

  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const { id } = await params;

  const result = await completeMission(session.id, id, body.data.proof);
  if ("error" in result && result.error) return fail(result.error, 400);
  return ok({ xp: result.xp, streak: result.streak });
});
