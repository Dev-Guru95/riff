import { describe, it, expect } from "vitest";
import {
  isSafeReturnUrl,
  normalizeReturnUrl,
  normalizeReturnLabel,
  resolveReturnLink,
  DEFAULT_RETURN_LABEL,
  RETURN_LABEL_MAX,
} from "./returnLink";
import { SKOOL_URL } from "./constants";

describe("return-link URL safety", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(isSafeReturnUrl("https://www.skool.com/soundrig/classroom/abc")).toBe(true);
    expect(isSafeReturnUrl("http://example.com")).toBe(true);
  });

  it("rejects script-bearing and non-web protocols", () => {
    // These parse fine via new URL() — the protocol check is what stops them.
    expect(isSafeReturnUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeReturnUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeReturnUrl("mailto:a@b.com")).toBe(false);
  });

  it("rejects relative paths and junk", () => {
    expect(isSafeReturnUrl("/courses/track-2")).toBe(false);
    expect(isSafeReturnUrl("www.skool.com")).toBe(false);
    expect(isSafeReturnUrl("")).toBe(false);
  });
});

describe("normalization", () => {
  it("treats blank input as cleared", () => {
    expect(normalizeReturnUrl("")).toBeNull();
    expect(normalizeReturnUrl("   ")).toBeNull();
    expect(normalizeReturnUrl(null)).toBeNull();
    expect(normalizeReturnUrl(undefined)).toBeNull();
  });

  it("trims surrounding whitespace from a pasted URL", () => {
    expect(normalizeReturnUrl("  https://skool.com/x  ")).toBe("https://skool.com/x");
  });

  it("caps the label length", () => {
    expect(normalizeReturnLabel("x".repeat(200))?.length).toBe(RETURN_LABEL_MAX);
    expect(normalizeReturnLabel("  Continue to Track 2 ")).toBe("Continue to Track 2");
    expect(normalizeReturnLabel("")).toBeNull();
  });
});

describe("resolveReturnLink", () => {
  it("uses the course's own destination when set", () => {
    const link = resolveReturnLink({
      returnUrl: "https://www.skool.com/soundrig/classroom/track-2",
      returnLabel: "Continue to Track 2",
    });
    expect(link.url).toBe("https://www.skool.com/soundrig/classroom/track-2");
    expect(link.label).toBe("Continue to Track 2");
    expect(link.isFallback).toBe(false);
  });

  it("falls back to the community root when unset, so the loop still closes", () => {
    const link = resolveReturnLink({ returnUrl: null, returnLabel: null });
    expect(link.url).toBe(SKOOL_URL);
    expect(link.label).toBe(DEFAULT_RETURN_LABEL);
    expect(link.isFallback).toBe(true);
  });

  it("falls back rather than rendering an unsafe stored value", () => {
    const link = resolveReturnLink({ returnUrl: "javascript:alert(1)", returnLabel: null });
    expect(link.url).toBe(SKOOL_URL);
    expect(link.isFallback).toBe(true);
  });

  it("drops a destination-specific label when falling back, so the button can't mislead", () => {
    const link = resolveReturnLink({ returnUrl: "", returnLabel: "Continue to Track 2" });
    expect(link.url).toBe(SKOOL_URL);
    expect(link.label).toBe(DEFAULT_RETURN_LABEL);
    expect(link.isFallback).toBe(true);
  });
});
