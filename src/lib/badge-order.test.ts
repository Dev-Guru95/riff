import { describe, it, expect } from "vitest";
import {
  JOURNEY_BADGE_ORDER,
  journeyBadgeOrder,
  trackBadgeOrder,
  BADGE_ORDER_CAPSTONE,
  BADGE_ORDER_UNKNOWN,
  PROGRAM_BADGE_KEY,
} from "./constants";
import { trackBadgeMeta } from "./gamification";

describe("badge wall ordering", () => {
  it("keeps the journey badges in their documented sequence", () => {
    const positions = JOURNEY_BADGE_ORDER.map(journeyBadgeOrder);
    expect(positions).toEqual([10, 20, 30, 40, 50]);
    // Strictly ascending — the sort must be total, or the wall can still shuffle.
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("sorts every track badge after every journey badge", () => {
    const lastJourney = Math.max(...JOURNEY_BADGE_ORDER.map(journeyBadgeOrder));
    expect(trackBadgeOrder(0)).toBeGreaterThan(lastJourney);
  });

  it("sorts track badges in track order", () => {
    expect(trackBadgeOrder(0)).toBeLessThan(trackBadgeOrder(1));
    expect(trackBadgeOrder(1)).toBeLessThan(trackBadgeOrder(7));
  });

  it("puts the program capstone last, after all eight tracks", () => {
    expect(BADGE_ORDER_CAPSTONE).toBeGreaterThan(trackBadgeOrder(7));
    expect(BADGE_ORDER_CAPSTONE).toBeGreaterThan(BADGE_ORDER_UNKNOWN);
  });

  it("gives an unrecognised key the column default, so it never sorts first", () => {
    expect(journeyBadgeOrder("not-a-real-badge")).toBe(BADGE_ORDER_UNKNOWN);
    expect(journeyBadgeOrder(PROGRAM_BADGE_KEY)).toBe(BADGE_ORDER_UNKNOWN);
    expect(journeyBadgeOrder("not-a-real-badge")).toBeGreaterThan(
      Math.max(...JOURNEY_BADGE_ORDER.map(journeyBadgeOrder)),
    );
  });

  it("carries the track's position onto its badge metadata", () => {
    const meta = trackBadgeMeta({ slug: "track-3-the-industry-map", title: "Track 3", orderIndex: 2 });
    expect(meta.orderIndex).toBe(trackBadgeOrder(2));
  });

  it("defaults a course with no orderIndex to the first track slot", () => {
    const meta = trackBadgeMeta({ slug: "x", title: "X" });
    expect(meta.orderIndex).toBe(trackBadgeOrder(0));
  });

  it("produces a stable total order for a realistic mixed badge wall", () => {
    const wall = [
      { key: PROGRAM_BADGE_KEY, orderIndex: BADGE_ORDER_CAPSTONE },
      { key: "track:t2", orderIndex: trackBadgeOrder(1) },
      { key: "first_steps", orderIndex: journeyBadgeOrder("first_steps") },
      { key: "track:t1", orderIndex: trackBadgeOrder(0) },
      { key: "streak_7", orderIndex: journeyBadgeOrder("streak_7") },
    ];
    // Mirrors the dashboard query: orderIndex asc, then key asc as tiebreaker.
    const sorted = [...wall].sort((a, b) => a.orderIndex - b.orderIndex || a.key.localeCompare(b.key));
    expect(sorted.map((b) => b.key)).toEqual([
      "first_steps",
      "streak_7",
      "track:t1",
      "track:t2",
      PROGRAM_BADGE_KEY,
    ]);
  });
});
