import { describe, it, expect } from "vitest";
import { rateLimit } from "./ratelimit";

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = "test:block";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    expect(rateLimit("test:a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("test:b", 1, 60_000).ok).toBe(true); // different key, not blocked
    expect(rateLimit("test:a", 1, 60_000).ok).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "test:reset";
    expect(rateLimit(key, 1, 1).ok).toBe(true); // 1ms window
    // window expired by next tick
    return new Promise((r) => setTimeout(r, 5)).then(() => {
      expect(rateLimit(key, 1, 1).ok).toBe(true);
    });
  });
});
