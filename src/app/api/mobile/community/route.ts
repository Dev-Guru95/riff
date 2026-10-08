import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { getCommunityStatus, SKOOL_COMMUNITY_URL } from "@/lib/community";
import type { CommunityResponse } from "@/lib/mobile/types";

// GET /api/mobile/community — src/app/(app)/community/page.tsx. The page
// redirects members to Skool; here `redirectTo` carries that destination.
// Non-members see the join onboarding (request via POST /api/community/join).
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const [status, user] = await Promise.all([
    getCommunityStatus(session.id),
    prisma.user.findUnique({ where: { id: session.id }, select: { skoolHandle: true } }),
  ]);

  const body: CommunityResponse = {
    status,
    skoolUrl: SKOOL_COMMUNITY_URL,
    redirectTo: status === "member" ? SKOOL_COMMUNITY_URL : null,
    alreadyRequested: status === "pending",
    skoolHandle: user?.skoolHandle ?? null,
  };
  return ok(body);
});
