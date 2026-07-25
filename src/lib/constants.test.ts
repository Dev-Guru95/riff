import { describe, it, expect } from "vitest";
import { resolveLevel, xpThresholdForLevel, LEVELS } from "./constants";

describe("xp levels", () => {
  it("starts at Beginner Artist with 0 XP", () => {
    const l = resolveLevel(0);
    expect(l.levelIndex).toBe(0);
    expect(l.levelKey).toBe("beginner_artist");
    expect(l.progressPct).toBe(0);
  });

  it("thresholds are monotonically increasing", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(xpThresholdForLevel(i)).toBeGreaterThan(xpThresholdForLevel(i - 1));
    }
  });

  it("reaches the next level exactly at its threshold", () => {
    const floor = xpThresholdForLevel(1);
    expect(resolveLevel(floor).levelIndex).toBe(1);
    expect(resolveLevel(floor - 1).levelIndex).toBe(0);
  });

  it("caps at Music Entrepreneur (max level)", () => {
    const l = resolveLevel(10_000_000);
    expect(l.levelIndex).toBe(LEVELS.length - 1);
    expect(l.levelKey).toBe("music_entrepreneur");
    expect(l.isMax).toBe(true);
    expect(l.progressPct).toBe(100);
    expect(l.nextLevelName).toBeNull();
  });

  it("progress percentage stays within 0..100", () => {
    for (const xp of [0, 50, 150, 999, 5000, 50000]) {
      const p = resolveLevel(xp).progressPct;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});
