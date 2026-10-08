// Typed string-constant unions (portable across SQLite/Postgres; on Postgres
// these become native enums).

// The official SoundRig Skool community. Community + AI Coach unlock by joining.
// Override the destination via NEXT_PUBLIC_SKOOL_URL.
export const SKOOL_URL =
  process.env.NEXT_PUBLIC_SKOOL_URL || "https://www.skool.com/soundrig-music-skool-2426";

export const ROLES = ["artist", "admin", "reviewer", "moderator"] as const;
export type Role = (typeof ROLES)[number];

export const LESSON_STATUS = ["locked", "available", "in_progress", "completed"] as const;
export type LessonStatus = (typeof LESSON_STATUS)[number];

export const SUBMISSION_STATUS = ["processing", "reviewed", "flagged", "resubmit"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const XP_SOURCES = ["lesson", "quiz", "assignment", "mission", "streak", "bonus"] as const;
export type XpSource = (typeof XP_SOURCES)[number];

// ===== Project Management (Kanban) =====
// Per-board roles, most→least privileged. `owner` is the board creator (exactly
// one); the rest are grantable. Capability checks live in src/lib/boards.ts.
export const BOARD_ROLES = ["owner", "admin", "manager", "member", "guest"] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

export const CARD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type CardPriority = (typeof CARD_PRIORITIES)[number];

// UI accent tokens (map to the CSS vars in globals.css) reused for board/label colours.
export const UI_COLORS = ["brand", "brand-2", "accent", "success", "warning", "muted"] as const;
export type UiColor = (typeof UI_COLORS)[number];

// ===== Achievements: the program & its badges =====
// Artists work through one learning *program* made of ordered courses (tracks).
// Finishing a track earns that track's badge; finishing EVERY published track
// earns the single program certificate + the capstone badge. `PROGRAM_KEY` is
// the seam for supporting multiple programs later.
export const PROGRAM_KEY = "riff";
export const PROGRAM_TITLE = "SoundRig Artist Program";
export const PROGRAM_BADGE_KEY = "program_graduate";

/** Stable, env-portable key for a course's track-completion badge (slug-based,
 *  so it survives re-seeding where cuid course ids would not). */
export function trackBadgeKey(slug: string): string {
  return `track:${slug}`;
}

export function isTrackBadgeKey(key: string): boolean {
  return key.startsWith("track:");
}

// ===== Badge wall ordering =====
// `Badge.orderIndex` decides the order of the dashboard's Achievements section.
// It exists because `findMany()` with no `orderBy` leaves the order to Postgres,
// which is free to change it between page loads (and does, after row updates) —
// the achievements appeared to shuffle at random.
//
// The order mirrors docs/ACHIEVEMENTS.md: the five journey badges in the order
// a learner realistically earns them, then one badge per track in *track* order,
// then the program capstone last as the thing everything else builds toward.
export const JOURNEY_BADGE_ORDER = [
  "first_steps",
  "quiz_whiz",
  "first_submission",
  "streak_7",
  "mission_marathon",
] as const;

/** Journey badges occupy 10, 20, 30…; a key not in the list sorts after them. */
export function journeyBadgeOrder(key: string): number {
  const i = JOURNEY_BADGE_ORDER.indexOf(key as (typeof JOURNEY_BADGE_ORDER)[number]);
  return i === -1 ? BADGE_ORDER_UNKNOWN : (i + 1) * 10;
}

/** Track badges sit between the journey badges and the capstone, in track order. */
export function trackBadgeOrder(courseOrderIndex: number): number {
  return BADGE_ORDER_TRACK_BASE + courseOrderIndex;
}

export const BADGE_ORDER_TRACK_BASE = 100;
export const BADGE_ORDER_CAPSTONE = 900;
/** Matches the column default: anything unclassified sorts after the tracks. */
export const BADGE_ORDER_UNKNOWN = 500;

// Progression levels: Beginner Artist -> Music Entrepreneur
export const LEVELS = [
  { key: "beginner_artist", name: "Beginner Artist" },
  { key: "rising_creator", name: "Rising Creator" },
  { key: "brand_builder", name: "Brand Builder" },
  { key: "content_strategist", name: "Content Strategist" },
  { key: "fan_cultivator", name: "Fan Cultivator" },
  { key: "release_pro", name: "Release Pro" },
  { key: "growth_marketer", name: "Growth Marketer" },
  { key: "industry_operator", name: "Industry Operator" },
  { key: "music_entrepreneur", name: "Music Entrepreneur" },
] as const;

// XP needed to *reach* level index n (cumulative). Gentle exponential.
export function xpThresholdForLevel(levelIndex: number): number {
  if (levelIndex <= 0) return 0;
  return Math.round(100 * Math.pow(levelIndex, 1.6));
}

// Given total XP, resolve the current level index/key + progress to next.
export function resolveLevel(totalXp: number) {
  let levelIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= xpThresholdForLevel(i)) {
      levelIndex = i;
      break;
    }
  }
  const current = LEVELS[levelIndex];
  const isMax = levelIndex >= LEVELS.length - 1;
  const currentFloor = xpThresholdForLevel(levelIndex);
  const nextFloor = isMax ? currentFloor : xpThresholdForLevel(levelIndex + 1);
  const span = Math.max(1, nextFloor - currentFloor);
  const progressPct = isMax ? 100 : Math.min(100, Math.round(((totalXp - currentFloor) / span) * 100));
  return {
    levelIndex,
    levelKey: current.key,
    levelName: current.name,
    nextLevelName: isMax ? null : LEVELS[levelIndex + 1].name,
    xpIntoLevel: totalXp - currentFloor,
    xpForNextLevel: isMax ? 0 : nextFloor - currentFloor,
    progressPct,
    isMax,
  };
}
