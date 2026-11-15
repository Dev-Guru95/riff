import { describe, it, expect } from "vitest";
import {
  COUNTRY_CODES,
  GENRES,
  MAX_GENRES,
  isCountryCode,
  isGenre,
  countryName,
  countryOptions,
  genreLabel,
} from "./profile-options";

describe("country codes", () => {
  it("accepts real ISO alpha-2 codes and rejects anything else", () => {
    expect(isCountryCode("NG")).toBe(true);
    expect(isCountryCode("US")).toBe(true);
    expect(isCountryCode("GB")).toBe(true);
    // Lowercase is the caller's job to normalise — the API uppercases first.
    expect(isCountryCode("ng")).toBe(false);
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("")).toBe(false);
  });

  it("has no duplicates, which would double a country in the select", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it("every code is two uppercase letters", () => {
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });

  it("resolves display names, falling back to the code", () => {
    expect(countryName("NG")).toBe("Nigeria");
    // Not a region Intl knows; must not throw or return undefined.
    expect(countryName("ZZ")).toBeTruthy();
  });

  it("lists options sorted by name", () => {
    const names = countryOptions().map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("genres", () => {
  it("accepts listed genres only", () => {
    expect(isGenre("afrobeats")).toBe(true);
    expect(isGenre("hip-hop")).toBe(true);
    // Free text is exactly what the fixed list exists to prevent: "hiphop",
    // "Hip Hop" and "hip-hop" would each get their own genre leaderboard.
    expect(isGenre("hiphop")).toBe(false);
    expect(isGenre("Hip Hop")).toBe(false);
    expect(isGenre("")).toBe(false);
  });

  it("has unique values and non-empty labels", () => {
    const values = GENRES.map((g) => g.value);
    expect(new Set(values).size).toBe(values.length);
    expect(GENRES.every((g) => g.label.trim().length > 0)).toBe(true);
  });

  it("stores lowercase values so two artists picking the same genre match", () => {
    expect(GENRES.every((g) => g.value === g.value.toLowerCase())).toBe(true);
  });

  it("labels fall back to the raw value", () => {
    expect(genreLabel("afrobeats")).toBe("Afrobeats");
    expect(genreLabel("unknown-genre")).toBe("unknown-genre");
  });

  it("allows a small, fixed number of picks", () => {
    expect(MAX_GENRES).toBeGreaterThan(0);
    expect(MAX_GENRES).toBeLessThanOrEqual(5);
  });
});
