import { describe, it, expect } from "vitest";
import { chainTrackReturns } from "./returnLink";

// The real program, in the order the numbered course files produce.
const SLUGS = [
  "track-1-the-call-to-create",
  "track-2-the-dna-of-a-song",
  "track-3-the-industry-map",
  "track-4-revenue-centers",
  "track-5-marketing-pr",
  "track-6-ai-in-music",
  "track-7-soundrig-music",
  "track-8-are-you-serious",
];

const skool = (n: number) => ({ track: n, url: `https://www.skool.com/soundrig/track-${n}` });
const allEight = [1, 2, 3, 4, 5, 6, 7, 8].map(skool);
const byslug = (chain: ReturnType<typeof chainTrackReturns>) =>
  Object.fromEntries(chain.map((c) => [c.slug, c.url]));

describe("chainTrackReturns", () => {
  it("sends each track to the NEXT Skool track", () => {
    const map = byslug(chainTrackReturns(SLUGS, allEight));
    expect(map["track-1-the-call-to-create"]).toBe("https://www.skool.com/soundrig/track-2");
    expect(map["track-7-soundrig-music"]).toBe("https://www.skool.com/soundrig/track-8");
  });

  it("labels the button with the track it actually opens", () => {
    const chain = chainTrackReturns(SLUGS, allEight);
    expect(chain.find((c) => c.slug === "track-1-the-call-to-create")?.label).toBe("Continue to Track 2");
    expect(chain.find((c) => c.slug === "track-6-ai-in-music")?.label).toBe("Continue to Track 7");
  });

  it("never points a track back at itself", () => {
    for (const link of chainTrackReturns(SLUGS, allEight)) {
      const ownNumber = SLUGS.indexOf(link.slug) + 1;
      expect(link.url).not.toBe(`https://www.skool.com/soundrig/track-${ownNumber}`);
    }
  });

  it("sends the final track to graduation, not to a ninth track", () => {
    const chain = chainTrackReturns(SLUGS, allEight, {
      url: "https://www.skool.com/soundrig/the-keys",
      label: "Unlock The Keys",
    });
    expect(chain.find((c) => c.slug === "track-8-are-you-serious")).toMatchObject({
      url: "https://www.skool.com/soundrig/the-keys",
      label: "Unlock The Keys",
    });
  });

  it("leaves the final track unwired when no graduation URL is set", () => {
    // Falls back to the community root rather than inventing a destination.
    const chain = chainTrackReturns(SLUGS, allEight);
    expect(chain.find((c) => c.slug === "track-8-are-you-serious")).toBeUndefined();
    expect(chain).toHaveLength(7);
  });

  it("treats the LAST TRACK IN THE PROGRAM as graduating, not the last one configured", () => {
    // Regression: an earlier version took the track count from the database, so
    // a partial import made whichever track happened to be last graduate early.
    // Track 3 must still be told to continue to Track 4, never handed the keys.
    const chain = chainTrackReturns(SLUGS, [skool(2), skool(3), skool(4)], {
      url: "https://www.skool.com/soundrig/the-keys",
    });
    expect(chain.find((c) => c.slug === "track-3-the-industry-map")).toMatchObject({
      url: "https://www.skool.com/soundrig/track-4",
      label: "Continue to Track 4",
    });
    expect(chain.some((c) => c.url.endsWith("/the-keys") && c.slug !== "track-8-are-you-serious")).toBe(false);
  });

  it("identifies tracks by slug, so a missing track cannot shift the others", () => {
    // Regression: an earlier version indexed by position in the database result,
    // so one absent track silently wired every later track to the wrong place.
    const map = byslug(chainTrackReturns(SLUGS, allEight));
    for (const [slug, url] of Object.entries(map)) {
      const n = SLUGS.indexOf(slug) + 1;
      expect(url).toBe(`https://www.skool.com/soundrig/track-${n + 1}`);
    }
  });

  it("wires what it can from a half-filled config and skips the rest", () => {
    const chain = chainTrackReturns(SLUGS, [skool(2), skool(3), { track: 4, url: "" }]);
    expect(chain.map((c) => c.slug)).toEqual(["track-1-the-call-to-create", "track-2-the-dna-of-a-song"]);
  });

  it("skips unsafe URLs rather than writing them into an href", () => {
    const chain = chainTrackReturns(SLUGS, [
      { track: 2, url: "javascript:alert(1)" },
      { track: 3, url: "https://www.skool.com/soundrig/track-3" },
    ]);
    expect(chain.map((c) => c.slug)).toEqual(["track-2-the-dna-of-a-song"]);
  });

  it("coerces a track number that arrives from JSON as a string", () => {
    const chain = chainTrackReturns(SLUGS, [
      { track: "2" as unknown as number, url: "https://www.skool.com/soundrig/track-2" },
    ]);
    expect(chain[0]?.slug).toBe("track-1-the-call-to-create");
  });

  it("ignores malformed config entries instead of throwing", () => {
    const junk = [
      null,
      {},
      { track: "x", url: "https://example.com" },
      { track: 2 },
    ] as unknown as { track: number; url: string }[];
    expect(() => chainTrackReturns(SLUGS, junk)).not.toThrow();
    expect(chainTrackReturns(SLUGS, junk)).toEqual([]);
  });

  it("returns nothing for an entirely empty config", () => {
    expect(chainTrackReturns(SLUGS, [])).toEqual([]);
    expect(chainTrackReturns(SLUGS, allEight.map((l) => ({ ...l, url: "" })))).toEqual([]);
  });

  it("handles a one-track and an empty program without going out of bounds", () => {
    expect(chainTrackReturns([SLUGS[0]], allEight)).toEqual([]);
    expect(chainTrackReturns([], allEight)).toEqual([]);
  });

  it("does not depend on the config being in order", () => {
    const map = byslug(chainTrackReturns(SLUGS, [skool(5), skool(2), skool(8), skool(3)]));
    expect(map["track-1-the-call-to-create"]).toBe("https://www.skool.com/soundrig/track-2");
    expect(map["track-4-revenue-centers"]).toBe("https://www.skool.com/soundrig/track-5");
    expect(map["track-7-soundrig-music"]).toBe("https://www.skool.com/soundrig/track-8");
  });
});
