import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { notifyDueSoon } from "@/lib/boards";

// Notify assignees/watchers of cards due within 24h. Designed to be triggered by
// a scheduler (see vercel.json crons → daily). Auth (any of):
//  - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sets this when CRON_SECRET is configured)
//  - `x-cron-secret: <CRON_SECRET>` header (manual/other schedulers)
//  - an admin session (manual run from the app)
async function run(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  let authorized = false;
  if (secret && (headerSecret === secret || auth === `Bearer ${secret}`)) {
    authorized = true;
  } else {
    const session = await getSession();
    if (session && session.role === "admin") authorized = true;
  }
  if (!authorized) return fail("Not authorized", 401);
  const sent = await notifyDueSoon(24);
  return ok({ sent });
}

export const GET = withRoute(run); // Vercel Cron uses GET
export const POST = withRoute(run); // manual trigger
