import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { sendBroadcast } from "@/lib/studio-growth";

// POST /api/studio/broadcasts/[id]/send — record the send + matching-fan count.
// NOTE: actual email delivery requires an email provider (not configured); this
// records the broadcast as sent, mirroring the app's graceful-degradation pattern.
export const POST = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const count = await sendBroadcast(session.id, id);
  if (count === null) return fail("Broadcast not found or already sent", 404);
  return ok({ recipientCount: count });
});
