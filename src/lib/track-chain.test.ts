import { describe, it, expect } from "vitest";
import { chainTrackReturns } from "./returnLink";

const skool = (n: number) => ({ track: n, url: `https://www.skool.com/soundrig/track-${n}` });
const allEight = [1, 2, 3, 4, 5, 6, 7, 8].map(skool);

describe("chainTrackReturns", () => {
  it("sends each track to the NEXT Skool track, not its own", () => {
    // The off-by-one this exists to remove: finishing Riff track 1 must land on
    // Skool track 2, never back on track 1.
    const chain = chainTrackReturns(8, allEight);
    expect(chain[0]).toMatchObject({
      orderIndex: 0,
      url: "https://www.skool.com/soundrig/track-2",
      label: "Continue to Track 2",
    });
    expect(chain[6]).toMatchObject({
      orderIndex: 6,
      url: "https://www.skool.com/soundrig/track-8",
      label: "Continue to Track 8",
    });
  });

  it("never points a track at itself", () => {
    for (const link of chainTrackReturns(8, allEight)) {
      expect(link.url).not.toBe(`https://www.skool.com/soundrig/track-${link.orderIndex + 1}`);
    }
  });

  it("sends the final track to graduation, not to a ninth track", () => {
    const chain = chainTrackReturns(8, allEight, {
      url: "https://www.skool.com/soundrig/the-keys",
      label: "Unlock The Keys",
    });
    const last = chain.find((c) => c.orderIndex === 7);
    expect(last).toMatchObject({ url: "https://www.skool.com/soundrig/the-keys", label: "Unlock The Keys" });
  });

  it("leaves the final track unwired when no graduation URL is set", () => {
    // Falls back to the community root rather than inventing a destination.
    const chain = chainTrackReturns(8, allEight);
    expect(chain.find((c) => c.orderIndex === 7)).toBeUndefined();
    expect(chain).toHaveLength(7);
  });

  it("wires what it can from a half-filled config and skips the rest", () => {
    // The realistic in-progress case: someone has pasted the first few URLs.
    const chain = chainTrackReturns(8, [skool(2), skool(3), { track: 4, url: "" }]);
    expect(chain.map((c) => c.orderIndex)).toEqual([0, 1]);
  });

  it("skips unsafe URLs rather than writing them into an href", () => {
    const chain = chainTrackReturns(3, [
      { track: 2, url: "javascript:alert(1)" },
      { track: 3, url: "https://www.skool.com/soundrig/track-3" },
    ]);
    expect(chain.map((c) => c.orderIndex)).toEqual([1]);
    expect(chain[0].url).toBe("https://www.skool.com/soundrig/track-3");
  });

  it("returns nothing for an entirely empty config", () => {
    expect(chainTrackReturns(8, [])).toEqual([]);
    expect(chainTrackReturns(8, allEight.map((l) => ({ ...l, url: "" })))).toEqual([]);
  });

  it("handles a single-track program without going out of bounds", () => {
    expect(chainTrackReturns(1, allEight)).toEqual([]);
    expect(chainTrackReturns(0, allEight)).toEqual([]);
  });

  it("does not depend on the config being in order", () => {
    const shuffled = [skool(5), skool(2), skool(8), skool(3)];
    const chain = chainTrackReturns(8, shuffled);
    expect(chain.find((c) => c.orderIndex === 0)?.url).toBe("https://www.skool.com/soundrig/track-2");
    expect(chain.find((c) => c.orderIndex === 3)?.url).toBe("https://www.skool.com/soundrig/track-5");
  });
});
