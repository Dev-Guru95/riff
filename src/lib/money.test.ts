import { describe, it, expect } from "vitest";
import { toCents } from "./money";

describe("toCents", () => {
  it("parses plain decimals", () => {
    expect(toCents("1.50")).toBe(150);
    expect(toCents("25")).toBe(2500);
    expect(toCents("0.99")).toBe(99);
  });
  it("treats a lone comma as a decimal separator (EU locale)", () => {
    expect(toCents("1,50")).toBe(150);
    expect(toCents("0,05")).toBe(5);
  });
  it("treats comma as a thousands separator (dot present, or ,NNN grouping)", () => {
    expect(toCents("1,000.50")).toBe(100050);
    expect(toCents("2,500")).toBe(250000); // ,500 = 3 digits → thousands, not decimal
    expect(toCents("1,234,567")).toBe(123456700);
  });
  it("strips whitespace", () => {
    expect(toCents(" 1 000 ")).toBe(100000);
  });
  it("clamps negatives to 0 and handles junk", () => {
    expect(toCents("-5")).toBe(0);
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
  });
  it("never returns NaN or a fractional cent", () => {
    for (const v of ["1.005", "9.999", "", "x", "3,33"]) {
      const c = toCents(v);
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });
});
