import { describe, it, expect } from "vitest";
import { BUILDERS, builderFor } from "./studio";

describe("studio builders", () => {
  it("resolves known builder kinds and rejects unknown ones", () => {
    expect(builderFor("bio")?.kind).toBe("bio");
    expect(builderFor("editorial_pitch")?.kind).toBe("editorial_pitch");
    expect(builderFor("nope")).toBeNull();
  });

  it("has unique kinds", () => {
    const kinds = BUILDERS.map((b) => b.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("each builder's rubric weights sum to 100", () => {
    for (const b of BUILDERS) {
      const total = b.rubric.reduce((n, r) => n + r.weight, 0);
      expect(total, `${b.kind} weights`).toBe(100);
    }
  });

  it("each builder has instructions and a placeholder", () => {
    for (const b of BUILDERS) {
      expect(b.instructions.length).toBeGreaterThan(20);
      expect(b.placeholder.length).toBeGreaterThan(0);
    }
  });
});
