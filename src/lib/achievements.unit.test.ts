import { describe, it, expect } from "vitest";
import { isProgramCompleteFrom } from "./certificates";
import { trackBadgeMeta } from "./gamification";
import { trackBadgeKey, isTrackBadgeKey } from "./constants";

describe("program completion rule (pure)", () => {
  it("is incomplete when no courses are published", () => {
    expect(isProgramCompleteFrom([], [])).toBe(false);
    expect(isProgramCompleteFrom([], ["a"])).toBe(false);
  });

  it("is complete only when every published course is done", () => {
    expect(isProgramCompleteFrom(["a", "b"], ["a"])).toBe(false);
    expect(isProgramCompleteFrom(["a", "b"], ["a", "b"])).toBe(true);
  });

  it("ignores completed courses that are no longer published", () => {
    // 'c' is completed but not in the published set — shouldn't count against.
    expect(isProgramCompleteFrom(["a", "b"], ["a", "b", "c"])).toBe(true);
  });
});

describe("track badge metadata (pure)", () => {
  it("derives a stable, namespaced key from the course slug", () => {
    const meta = trackBadgeMeta({ slug: "marketing-foundations", title: "Music Marketing Foundations" });
    expect(meta.key).toBe(trackBadgeKey("marketing-foundations"));
    expect(meta.key).toBe("track:marketing-foundations");
    expect(isTrackBadgeKey(meta.key)).toBe(true);
  });

  it("names the badge after the course title", () => {
    const meta = trackBadgeMeta({ slug: "x", title: "Release Strategy" });
    expect(meta.name).toBe("Release Strategy Graduate");
    expect(meta.tier).toBe("gold");
  });
});
