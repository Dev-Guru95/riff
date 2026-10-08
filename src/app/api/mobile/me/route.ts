import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { STAFF_ROLES, toProfileInfo } from "@/lib/mobile/server";
import type { CommunityStatus, MeResponse } from "@/lib/mobile/types";

// GET /api/mobile/me — the signed-in user for the app shell (nav) and Settings.
// Mirrors src/app/(app)/layout.tsx + settings/page.tsx. Explicit select: never
// passwordHash / mfaSecret.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      countryCode: true,
      createdAt: true,
      mfaEnabled: true,
      skoolMember: true,
      skoolRequestedAt: true,
      skoolJoinedAt: true,
      skoolHandle: true,
      profile: {
        select: {
          stageName: true,
          genres: true,
          careerStage: true,
          audienceSize: true,
          goals: true,
          timezone: true,
        },
      },
      subscription: { select: { plan: true, status: true } },
    },
  });
  // A valid token for a deleted account is no session at all.
  if (!user) return fail("Not authenticated", 401);

  // Same rule as getCommunityStatus(), from the row already loaded.
  const communityStatus: CommunityStatus = user.skoolMember
    ? "member"
    : user.skoolRequestedAt
      ? "pending"
      : "none";

  const body: MeResponse = {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      countryCode: user.countryCode,
      createdAt: user.createdAt.toISOString(),
      mfaEnabled: user.mfaEnabled,
      isStaff: STAFF_ROLES.includes(user.role),
    },
    skool: {
      member: user.skoolMember,
      requestedAt: user.skoolRequestedAt?.toISOString() ?? null,
      joinedAt: user.skoolJoinedAt?.toISOString() ?? null,
      handle: user.skoolHandle,
      status: communityStatus,
    },
    profile: toProfileInfo(user.profile),
    plan: user.subscription?.plan ?? "free",
    subscription: user.subscription,
  };
  return ok(body);
});
