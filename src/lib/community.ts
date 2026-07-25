import { prisma } from "./prisma";
import { notify } from "./notifications";
import { track } from "./analytics";
import { SKOOL_URL } from "./constants";

// Single source of truth for the Skool community destination.
export { SKOOL_URL as SKOOL_COMMUNITY_URL };

/**
 * Skool membership is Riff's gate for Community + AI Coach. Access is granted by
 * ADMIN VERIFICATION only: a user requests access (requestCommunityAccess) and an
 * admin verifies (markSkoolMember). `markSkoolMember` is the single seam a real
 * Skool webhook would call later — keep all grant writes going through here.
 */
export async function isSkoolMember(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { skoolMember: true },
  });
  return !!user?.skoolMember;
}

export type CommunityStatus = "member" | "pending" | "none";

/** A user's community access status, for gating + onboarding UI. */
export async function getCommunityStatus(userId: string): Promise<CommunityStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { skoolMember: true, skoolRequestedAt: true },
  });
  if (user?.skoolMember) return "member";
  if (user?.skoolRequestedAt) return "pending";
  return "none";
}

/**
 * Record a user's request for community access. Does NOT grant access — an admin
 * must verify. Idempotent: re-requesting just refreshes the timestamp.
 */
export async function requestCommunityAccess(userId: string, handle?: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { skoolRequestedAt: new Date(), ...(handle ? { skoolHandle: handle } : {}) },
  });
  await track("community_request", userId, {});
}

/**
 * Grant community access. Admin-verify (or webhook) only. Clears any pending
 * request. Idempotent — re-verifying won't re-notify.
 */
export async function markSkoolMember(
  userId: string,
  opts: { handle?: string; source: "admin" | "webhook" } = { source: "admin" },
): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { skoolMember: true },
  });
  if (existing?.skoolMember) return; // already a member — no-op

  await prisma.user.update({
    where: { id: userId },
    data: {
      skoolMember: true,
      skoolJoinedAt: new Date(),
      skoolRequestedAt: null, // request fulfilled
      ...(opts.handle ? { skoolHandle: opts.handle } : {}),
    },
  });

  await notify(userId, {
    type: "community",
    title: "🎉 Community access approved!",
    body: "An admin verified your Skool membership. Community + AI Coach are now unlocked.",
    link: "/community",
  });
  await track("community_join", userId, { source: opts.source });
}

/** Revoke community access (admin action / left the community). */
export async function revokeSkoolMember(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { skoolMember: false, skoolJoinedAt: null },
  });
}
