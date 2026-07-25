import { describe, it, expect } from "vitest";
import { simulateMetrics, computeScores, buildRecommendations, type Metrics } from "./audit";

describe("audit scoring", () => {
  it("is deterministic for the same seed inputs", () => {
    const a = simulateMetrics("instagram", "artist", 1);
    const b = simulateMetrics("instagram", "artist", 1);
    expect(a).toEqual(b);
  });

  it("grows followers run over run (builds on prior snapshot)", () => {
    const run1 = simulateMetrics("tiktok", "nova", 1);
    const run2 = simulateMetrics("tiktok", "nova", 2, run1);
    expect(run2.followers).toBeGreaterThan(run1.followers);
    expect(run2.followerGrowth).toBeGreaterThan(0);
  });

  it("produces all four scores within 0..100", () => {
    const metrics = [simulateMetrics("instagram", "a", 1), simulateMetrics("tiktok", "a", 1)];
    const s = computeScores(metrics);
    for (const v of [s.marketingScore, s.brandingScore, s.growthScore, s.consistencyScore]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("returns zeros when there are no connected accounts", () => {
    expect(computeScores([])).toEqual({ marketingScore: 0, brandingScore: 0, growthScore: 0, consistencyScore: 0 });
  });

  it("recommendations prioritize the weakest area", () => {
    const weak: Metrics = {
      followers: 1000, followerGrowth: 200, posts: 10, engagementRate: 5,
      reach: 1200, postingVarianceDays: 7, bioComplete: true, visualConsistency: 10, // branding low
    };
    const recs = buildRecommendations(computeScores([weak]), [weak]);
    expect(recs[0].toLowerCase()).toContain("branding");
    expect(recs.length).toBeGreaterThan(0);
  });
});
