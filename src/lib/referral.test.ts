import { describe, it, expect } from "vitest";
import {
  normalizeReferral,
  signupUrl,
  SKOOL_TRACK_00_REF,
  REFERRAL_MAX_LENGTH,
} from "./referral";

describe("normalizeReferral", () => {
  it("accepts the Skool track tags we actually publish", () => {
    expect(normalizeReferral(SKOOL_TRACK_00_REF)).toBe("skool-track-00");
    expect(normalizeReferral("skool_track_00")).toBe("skool_track_00");
    expect(normalizeReferral("launchpad2026")).toBe("launchpad2026");
  });

  it("lowercases and trims, so a hand-typed link still attributes", () => {
    expect(normalizeReferral("  Skool-Track-00  ")).toBe("skool-track-00");
  });

  it("returns null for nothing", () => {
    expect(normalizeReferral(null)).toBeNull();
    expect(normalizeReferral(undefined)).toBeNull();
    expect(normalizeReferral("")).toBeNull();
    expect(normalizeReferral("   ")).toBeNull();
  });

  it("rejects anything that could carry markup, a URL, or PII", () => {
    // The tag is stored on the user and rendered in admin screens, so these are
    // rejected outright rather than sanitized.
    expect(normalizeReferral("<script>alert(1)</script>")).toBeNull();
    expect(normalizeReferral("https://evil.example.com")).toBeNull();
    expect(normalizeReferral("someone@example.com")).toBeNull();
    expect(normalizeReferral("track 00")).toBeNull();
    expect(normalizeReferral("track/00")).toBeNull();
    expect(normalizeReferral("-leading-hyphen")).toBeNull();
  });

  it("rejects an over-long tag rather than truncating it", () => {
    expect(normalizeReferral("a".repeat(REFERRAL_MAX_LENGTH))).toHaveLength(REFERRAL_MAX_LENGTH);
    expect(normalizeReferral("a".repeat(REFERRAL_MAX_LENGTH + 1))).toBeNull();
  });
});

describe("signupUrl", () => {
  it("builds the link that goes into Skool", () => {
    expect(signupUrl("https://riff-app.onrender.com", SKOOL_TRACK_00_REF)).toBe(
      "https://riff-app.onrender.com/signup?ref=skool-track-00",
    );
  });

  it("does not double up when the origin has a trailing slash", () => {
    expect(signupUrl("https://riff-app.onrender.com/", "x")).toBe(
      "https://riff-app.onrender.com/signup?ref=x",
    );
  });
});
