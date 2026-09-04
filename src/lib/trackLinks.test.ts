import { describe, it, expect } from "vitest";
import { quizPath, stepPath, parseStepNumber, absoluteUrl } from "./trackLinks";
import { safeNextPath } from "./nextPath";

describe("publishable track links", () => {
  it("builds addresses from the slug, not a database id", () => {
    // The whole point: these must survive a content re-import, which is exactly
    // what a /learn/<cuid> link does not.
    expect(quizPath("track-3-the-industry-map")).toBe("/courses/track-3-the-industry-map/quiz");
    expect(stepPath("track-1-the-call-to-create", 2)).toBe("/courses/track-1-the-call-to-create/step/2");
  });

  it("makes an absolute URL for pasting into Skool", () => {
    expect(absoluteUrl("https://riff-app.onrender.com", quizPath("track-1-the-call-to-create"))).toBe(
      "https://riff-app.onrender.com/courses/track-1-the-call-to-create/quiz",
    );
  });
});

describe("parseStepNumber", () => {
  it("accepts 1-based positive integers", () => {
    expect(parseStepNumber("1")).toBe(1);
    expect(parseStepNumber("24")).toBe(24);
  });

  it("rejects anything that would silently resolve to the wrong step", () => {
    // "01" would index the same lesson as "1" but is a different published URL;
    // rejecting it keeps one canonical address per step.
    expect(parseStepNumber("01")).toBeNull();
    expect(parseStepNumber("0")).toBeNull();
    expect(parseStepNumber("-1")).toBeNull();
    expect(parseStepNumber("1.5")).toBeNull();
    expect(parseStepNumber("1e3")).toBeNull();
    expect(parseStepNumber("abc")).toBeNull();
    expect(parseStepNumber("")).toBeNull();
    expect(parseStepNumber(" 1")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site destination so a Skool link survives the login screen", () => {
    expect(safeNextPath("/courses/track-1-the-call-to-create/quiz")).toBe(
      "/courses/track-1-the-call-to-create/quiz",
    );
    expect(safeNextPath("/dashboard?tab=1")).toBe("/dashboard?tab=1");
  });

  it("refuses to redirect off-site", () => {
    // The value comes from a query string, so a crafted link must not be able to
    // bounce someone from Riff's login form onto another origin.
    expect(safeNextPath("https://evil.example.com")).toBeNull();
    expect(safeNextPath("//evil.example.com")).toBeNull();
    expect(safeNextPath("/\\evil.example.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("dashboard")).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});
