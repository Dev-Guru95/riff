import { prisma } from "./prisma";
import { awardXp, touchStreak, type AwardResult } from "./gamification";
import { buildShare, type SharePayload } from "./share";
import type { XpSource } from "./constants";

// Centralized learning-event layer. Every place that rewards a learner
// (lesson/quiz/assignment/mission) delegates here instead of calling awardXp +
// touchStreak by hand. This is the one seam for cross-cutting side-effects:
// XP, streak, badges (inside awardXp), and Share-to-Skool suggestions — with
// room to add certificates, weekly-goal ticks, etc. without touching call-sites.

export type RecordInput = {
  userId: string;
  xp: number;
  source: XpSource;
  refId?: string;
  /** Whether this action counts toward the daily streak. Default true. */
  touchStreak?: boolean;
};

export type AchievementResult = {
  xp: AwardResult;
  streak: { currentLen: number; awardedBonus: number } | null;
  /** Prebuilt Share-to-Skool payloads for level-ups and new badges. */
  shares: SharePayload[];
};

export async function recordAchievement(input: RecordInput): Promise<AchievementResult> {
  const xp = await awardXp(input.userId, input.xp, input.source, input.refId);
  const streak = input.touchStreak === false ? null : await touchStreak(input.userId);

  // Suggest a share only for genuinely celebratory moments.
  const shares: SharePayload[] = [];
  if (xp.leveledUp || xp.newBadges.length > 0) {
    const profile = await prisma.artistProfile.findUnique({
      where: { userId: input.userId },
      select: { stageName: true },
    });
    const stageName = profile?.stageName ?? null;
    if (xp.leveledUp) shares.push(buildShare({ kind: "level", value: xp.level.levelName, stageName }));
    for (const b of xp.newBadges) {
      shares.push(buildShare({ kind: "badge", value: b.name, stageName, detail: `${b.icon}` }));
    }
  }

  return { xp, streak, shares };
}
