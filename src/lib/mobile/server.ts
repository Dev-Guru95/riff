// Small server-side helpers shared by the /api/mobile/* read endpoints. These
// only compose the same src/lib functions the web pages call — no new rules.

import { resolveLevel } from "@/lib/constants";
import type { ArtistProfileInfo, LevelInfo } from "./types";

/** JSON.parse with a fallback, so one malformed column never 500s a read. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Parse a JSON array column; anything that isn't an array becomes []. */
export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  const v = parseJson<unknown>(raw, []);
  return Array.isArray(v) ? (v as T[]) : [];
}

/** resolveLevel() exactly as the dashboard uses it, plus derived display values. */
export function levelInfo(totalXp: number): LevelInfo {
  const lvl = resolveLevel(totalXp);
  return {
    totalXp,
    levelIndex: lvl.levelIndex,
    levelNumber: lvl.levelIndex + 1,
    levelKey: lvl.levelKey,
    levelName: lvl.levelName,
    nextLevelName: lvl.nextLevelName,
    xpIntoLevel: lvl.xpIntoLevel,
    xpForNextLevel: lvl.xpForNextLevel,
    xpToNextLevel: lvl.isMax ? 0 : lvl.xpForNextLevel - lvl.xpIntoLevel,
    progressPct: lvl.progressPct,
    isMax: lvl.isMax,
  };
}

export function toProfileInfo(
  p: {
    stageName: string | null;
    genres: string;
    careerStage: string;
    audienceSize: number;
    goals: string;
    timezone: string;
  } | null,
): ArtistProfileInfo | null {
  if (!p) return null;
  return {
    stageName: p.stageName,
    genres: parseJsonArray<string>(p.genres).map(String),
    careerStage: p.careerStage,
    audienceSize: p.audienceSize,
    goals: parseJsonArray<string>(p.goals).map(String),
    timezone: p.timezone,
  };
}

/** `?page=` exactly as the web pages parse it. */
export function pageParam(raw: string | null): number {
  return Math.max(1, parseInt(raw ?? "1", 10) || 1);
}

export const STAFF_ROLES = ["admin", "reviewer", "moderator"];
