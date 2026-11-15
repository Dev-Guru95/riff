import { prisma } from "./prisma";
import { recordAchievement } from "./events";
import { notify } from "./notifications";
import { track } from "./analytics";

// ---- Weekly mission generation ----
//
// Concrete, artist-specific jobs rather than generic "post more" advice, and
// each one names what finishing it looks like — completing a mission now asks
// for proof (a link or a note), so a vague task is an unanswerable one.
//
// Ordered branding → content → engagement → release and repeating, so any three
// consecutive entries are from different categories and a week's slate is varied.
const MISSION_POOL = [
  { title: "Define Your Brand Pillars", description: "Write 3 words that describe your artist brand and a sentence on why each one fits you.", category: "branding", xpReward: 120, badgeKey: null },
  { title: "Post Every Day for 7 Days", description: "Keep a daily post going on your main platform all week. Link the last one when you're done.", category: "content", xpReward: 200, badgeKey: null },
  { title: "Engage 10 Real Fans", description: "Reply properly to 10 comments or DMs — not emojis, actual replies. Note who you spoke to.", category: "engagement", xpReward: 100, badgeKey: null },
  { title: "Run a Release Teaser", description: "Post a 10–20 second teaser of an upcoming or recent release. Link the post.", category: "release", xpReward: 180, badgeKey: null },

  { title: "Refresh Your Bio and Links", description: "Rewrite your bio around one clear hook and add your city, then update your link-in-bio.", category: "branding", xpReward: 90, badgeKey: null },
  { title: "Batch 5 Pieces of Content", description: "Make 5 posts in one sitting so a bad week never breaks your streak. Note what you batched.", category: "content", xpReward: 150, badgeKey: null },
  { title: "Reach Out to One Peer", description: "Message one artist at your level about a collab, a swap or a shoutout. Note who and what you proposed.", category: "engagement", xpReward: 160, badgeKey: null },
  { title: "Pitch 5 Playlist Curators", description: "Send 5 genuine pitches and log them on a Playlist Pitch Tracker board so you can follow up.", category: "release", xpReward: 200, badgeKey: null },

  { title: "Lock Your Visual Identity", description: "Pick 3 brand colours and 2 fonts and save them to your Brand Kit in Studio.", category: "branding", xpReward: 130, badgeKey: null },
  { title: "Teach One Thing You Know", description: "Post explaining how you made something — a hook, a drum sound, a lyric. Teaching posts travel furthest.", category: "content", xpReward: 160, badgeKey: null },
  { title: "Add 10 Fans to Your CRM", description: "Put 10 real people — fans, curators, promoters — into Fan CRM with a note on how you met.", category: "engagement", xpReward: 140, badgeKey: null },
  { title: "Write Your Editorial Pitch", description: "Use the Editorial Pitch Writer in Studio to draft your next pitch, then save it.", category: "release", xpReward: 170, badgeKey: null },

  { title: "Say What You Sound Like", description: "Write one sentence describing your sound, and use that same line everywhere. Link one profile using it.", category: "branding", xpReward: 100, badgeKey: null },
  { title: "Mirror Your Best Post", description: "Take your best-performing post of the month and repost it to a platform it never ran on.", category: "content", xpReward: 120, badgeKey: null },
  { title: "Ask Your Audience One Question", description: "Run a poll or question sticker and actually reply to the answers. Note what you learned.", category: "engagement", xpReward: 90, badgeKey: null },
  { title: "Plan Your Next Release", description: "Open a Release Planner board and fill in artwork, distribution, promo and press.", category: "release", xpReward: 190, badgeKey: null },

  { title: "Write Your Press Bio", description: "Write a 50-word and a 150-word version of your bio — the two lengths press and playlists actually ask for.", category: "branding", xpReward: 150, badgeKey: null },
  { title: "Build a Two-Week Calendar", description: "Fill a Content Calendar board with 14 days of planned posts so you stop deciding daily.", category: "content", xpReward: 180, badgeKey: null },
  { title: "Start 5 Conversations", description: "Post or reply 5 times in the community — ask something real, answer someone else.", category: "engagement", xpReward: 110, badgeKey: null },
  { title: "Submit to Editorial Early", description: "Submit an upcoming release to Spotify editorial at least 4 weeks ahead. Note the submission date.", category: "release", xpReward: 220, badgeKey: null },

  { title: "Match Your Profile Photos", description: "Use the same photo and handle on every platform so you are recognisable. Link two that now match.", category: "branding", xpReward: 80, badgeKey: null },
  { title: "Film Behind the Scenes", description: "Film 30 seconds of you actually working — writing, tracking, mixing. Link the post.", category: "content", xpReward: 140, badgeKey: null },
  { title: "Thank Ten People", description: "Thank 10 people who shared, saved or played your music. Note how you reached them.", category: "engagement", xpReward: 100, badgeKey: null },
  { title: "Write Your Release-Day Checklist", description: "List every job for release day — assets, links, posts, messages — so nothing is improvised.", category: "release", xpReward: 160, badgeKey: null },
];

export const MISSIONS_PER_WEEK = 3;

/**
 * The three missions for a given ISO week.
 *
 * Strides by three rather than offsetting by one: offsetting by the week number
 * alone reused two of the three missions every week, so the slate barely moved.
 * Striding walks the whole pool before anything repeats. Extracted so the
 * rotation is unit-testable without a database.
 */
export function pickMissionsForWeek(weekNum: number) {
  const start = (weekNum * MISSIONS_PER_WEEK) % MISSION_POOL.length;
  return Array.from({ length: MISSIONS_PER_WEEK }, (_, i) => MISSION_POOL[(start + i) % MISSION_POOL.length]);
}

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
  if ((await prisma.mission.count({ where: { weekKey } })) > 0) return;

  const weekNum = parseInt(weekKey.split("-W")[1], 10);
  const picks = pickMissionsForWeek(weekNum);
  const activeTo = new Date(now.getTime() + 7 * 86_400_000);

  // Two first visits of a new week can both see a count of 0; without a lock
  // each creates a full set and every mission shows twice. The transaction-
  // scoped advisory lock serialises them, and the re-count inside it makes the
  // second one a no-op.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`missions:${weekKey}`}::text))`;
    if ((await tx.mission.count({ where: { weekKey } })) > 0) return;
    await tx.mission.createMany({
      data: picks.map((p) => ({ ...p, weekKey, activeFrom: now, activeTo })),
    });
  });
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
  const byMission = new Map(userMissions.map((um) => [um.missionId, um]));
  return missions.map((m) => {
    const um = byMission.get(m.id);
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      xpReward: m.xpReward,
      status: um?.status ?? "available",
      // Shown back on a completed mission so the artist can see what they
      // submitted (and a reviewer can check it).
      proof: um?.proof ?? null,
    };
  });
}

/** Shortest proof we accept. Long enough to rule out "done" or a stray tap. */
export const MISSION_PROOF_MIN = 10;
export const MISSION_PROOF_MAX = 500;

/** Mark a mission complete (idempotent) and award XP + streak + badge + notify. */
export async function completeMission(userId: string, missionId: string, proof: string) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return { error: "Mission not found" as const };

  // Proof is what makes the XP mean something. Checked here rather than only in
  // the route so every caller — web, mobile, anything later — gets the rule.
  const trimmed = proof.trim();
  if (trimmed.length < MISSION_PROOF_MIN) {
    return { error: "Add a link or a short note describing what you did." as const };
  }
  if (trimmed.length > MISSION_PROOF_MAX) {
    return { error: `Keep it under ${MISSION_PROOF_MAX} characters.` as const };
  }

  const existing = await prisma.userMission.findUnique({
    where: { userId_missionId: { userId, missionId } },
  });
  if (existing?.status === "completed") {
    return { error: "Mission already completed" as const };
  }

  await prisma.userMission.upsert({
    where: { userId_missionId: { userId, missionId } },
    create: { userId, missionId, status: "completed", proof: trimmed, completedAt: new Date() },
    update: { status: "completed", proof: trimmed, completedAt: new Date() },
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
