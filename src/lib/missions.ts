import { prisma } from "./prisma";
import { recordAchievement } from "./events";
import { notify } from "./notifications";
import { track } from "./analytics";

// ---- Weekly mission generation ----
const MISSION_POOL = [
  { title: "Define Your Brand Pillars", description: "Write 3 words that describe your artist brand and explain each.", category: "branding", xpReward: 120, badgeKey: null },
  { title: "Post Every Day for 7 Days", description: "Maintain a daily post on your main platform all week.", category: "content", xpReward: 200, badgeKey: null },
  { title: "Engage 10 Fans", description: "Reply meaningfully to 10 comments or DMs this week.", category: "engagement", xpReward: 100, badgeKey: null },
  { title: "Refresh Your Bio & Links", description: "Rewrite your bio with a clear hook and update your link-in-bio.", category: "branding", xpReward: 90, badgeKey: null },
  { title: "Batch 5 Pieces of Content", description: "Create 5 posts in one session so you never miss a day.", category: "content", xpReward: 150, badgeKey: null },
  { title: "Run a Release Teaser", description: "Post a teaser clip for an upcoming or recent release.", category: "release", xpReward: 180, badgeKey: null },
  { title: "Collaborate With a Peer", description: "Reach out to one artist your size about a collab or shoutout.", category: "engagement", xpReward: 160, badgeKey: null },
];

/** ISO-week key like 2026-W25 (no Date.now in tests — uses a passed clock here). */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Ensure this week's mission set exists (idempotent on weekKey). Rotates a subset
 * of the pool so the slate changes week to week. Safe to call on every visit.
 */
export async function ensureWeeklyMissions(now = new Date()): Promise<void> {
  const weekKey = isoWeekKey(now);
  const existing = await prisma.mission.count({ where: { weekKey } });
  if (existing > 0) return;

  // Rotate: pick 3 missions offset by the week number so the slate varies.
  const weekNum = parseInt(weekKey.split("-W")[1], 10);
  const picks = [0, 1, 2].map((i) => MISSION_POOL[(weekNum + i) % MISSION_POOL.length]);
  const activeTo = new Date(now.getTime() + 7 * 86_400_000);

  for (const p of picks) {
    await prisma.mission.create({
      data: { ...p, weekKey, activeFrom: now, activeTo },
    });
  }
}

/** Active missions joined with this user's status. */
export async function getMissionsForUser(userId: string) {
  await ensureWeeklyMissions();
  const now = new Date();
  const missions = await prisma.mission.findMany({
    where: { activeFrom: { lte: now }, OR: [{ activeTo: null }, { activeTo: { gte: now } }] },
    orderBy: { xpReward: "asc" },
  });
  const userMissions = await prisma.userMission.findMany({ where: { userId } });
  const statusMap = new Map(userMissions.map((um) => [um.missionId, um.status]));
  return missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    xpReward: m.xpReward,
    status: statusMap.get(m.id) ?? "available",
  }));
}

/** Mark a mission complete (idempotent) and award XP + streak + badge + notify. */
export async function completeMission(userId: string, missionId: string) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return { error: "Mission not found" as const };

  const existing = await prisma.userMission.findUnique({
    where: { userId_missionId: { userId, missionId } },
  });
  if (existing?.status === "completed") {
    return { error: "Mission already completed" as const };
  }

  await prisma.userMission.upsert({
    where: { userId_missionId: { userId, missionId } },
    create: { userId, missionId, status: "completed", completedAt: new Date() },
    update: { status: "completed", completedAt: new Date() },
  });

  const { xp, streak } = await recordAchievement({ userId, xp: mission.xpReward, source: "mission", refId: missionId });

  // Optional linked badge.
  if (mission.badgeKey) {
    const badge = await prisma.badge.findUnique({ where: { key: mission.badgeKey } });
    if (badge) {
      await prisma.userBadge
        .create({ data: { userId, badgeId: badge.id } })
        .catch(() => {}); // ignore if already earned
    }
  }

  await notify(userId, { type: "mission", title: `Mission complete: ${mission.title}`, body: `+${mission.xpReward} XP`, link: "/missions" });
  await track("mission_complete", userId, { missionId, xp: mission.xpReward });

  return { xp, streak, mission };
}
