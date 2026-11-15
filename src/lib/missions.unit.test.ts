import { describe, it, expect } from "vitest";
import { pickMissionsForWeek, MISSIONS_PER_WEEK, MISSION_PROOF_MIN, MISSION_PROOF_MAX } from "./missions";

describe("weekly mission rotation", () => {
  it("gives a full slate every week", () => {
    for (let week = 1; week <= 53; week++) {
      const picks = pickMissionsForWeek(week);
      expect(picks).toHaveLength(MISSIONS_PER_WEEK);
      expect(picks.every((p) => !!p?.title)).toBe(true);
    }
  });

  it("never repeats a mission inside one week", () => {
    for (let week = 1; week <= 53; week++) {
      const titles = pickMissionsForWeek(week).map((p) => p.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("shares nothing with the following week", () => {
    // The original rotation offset by 1, so two of three missions carried over
    // every week and the slate looked static. This is the regression guard.
    for (let week = 1; week <= 53; week++) {
      const thisWeek = new Set(pickMissionsForWeek(week).map((p) => p.title));
      const nextWeek = pickMissionsForWeek(week + 1).map((p) => p.title);
      expect(nextWeek.some((t) => thisWeek.has(t))).toBe(false);
    }
  });

  it("mixes categories so a week is never all one kind of work", () => {
    for (let week = 1; week <= 53; week++) {
      const categories = pickMissionsForWeek(week).map((p) => p.category);
      expect(new Set(categories).size).toBe(categories.length);
    }
  });

  it("works through the whole pool before coming back round", () => {
    const seen = new Set<string>();
    // 8 weeks x 3 = the full 24-mission pool.
    for (let week = 0; week < 8; week++) {
      for (const p of pickMissionsForWeek(week)) seen.add(p.title);
    }
    expect(seen.size).toBe(24);
  });

  it("describes what finishing looks like, since proof is required", () => {
    const all = Array.from({ length: 8 }, (_, w) => pickMissionsForWeek(w)).flat();
    for (const m of all) {
      expect(m.description.length).toBeGreaterThan(40);
      expect(m.xpReward).toBeGreaterThan(0);
    }
  });
});

describe("proof bounds", () => {
  it("asks for more than a word but less than an essay", () => {
    expect(MISSION_PROOF_MIN).toBeGreaterThanOrEqual(5);
    expect(MISSION_PROOF_MAX).toBeGreaterThan(MISSION_PROOF_MIN);
    expect(MISSION_PROOF_MAX).toBeLessThanOrEqual(2000);
  });
});
