import { describe, it, expect } from "vitest";
import { inferMemoryKind, assignmentSourceKey, MEMORY_KINDS } from "./artist-context";

describe("inferMemoryKind", () => {
  it("routes the True Fan avatar action step to the audience bucket", () => {
    // The step this feature was built for, worded as it is in Track 1.
    expect(
      inferMemoryKind({
        title: "Define Your True Fan Avatar",
        instructions: "Write a one-paragraph description of your ideal listener.",
      }),
    ).toBe("audience");
  });

  it("classifies from the instructions when the title is the parser's generic one", () => {
    // The heuristic docx parser titles every assignment "Short-answer questions"
    // (course-import/README.md), so the instructions have to carry the signal.
    expect(
      inferMemoryKind({
        title: "Short-answer questions",
        instructions: "Define your True Fan avatar — who is your core audience?",
      }),
    ).toBe("audience");
  });

  it("recognises goal, genre and brand-shaped steps", () => {
    expect(inferMemoryKind({ title: "Your 90-day goal", instructions: "Set one milestone." })).toBe("goal");
    expect(inferMemoryKind({ title: "Your sound", instructions: "Name three genre influences." })).toBe("genre");
    expect(inferMemoryKind({ title: "Brand pillars", instructions: "Write three words." })).toBe("preference");
  });

  it("falls back to insight rather than guessing", () => {
    expect(inferMemoryKind({ title: "Untitled", instructions: "Reflect on this week." })).toBe("insight");
  });

  it("only ever returns a kind the AI coach understands", () => {
    const samples = [
      { title: "Fan avatar", instructions: "" },
      { title: "Goal", instructions: "" },
      { title: "Sound", instructions: "" },
      { title: "Brand", instructions: "" },
      { title: "", instructions: "" },
    ];
    for (const s of samples) {
      expect(MEMORY_KINDS).toContain(inferMemoryKind(s));
    }
  });
});

describe("assignmentSourceKey", () => {
  it("is stable, so re-submitting replaces the memory instead of stacking one", () => {
    expect(assignmentSourceKey("abc123")).toBe("assignment:abc123");
    expect(assignmentSourceKey("abc123")).toBe(assignmentSourceKey("abc123"));
  });

  it("is namespaced, so it cannot collide with another memory source", () => {
    expect(assignmentSourceKey("x")).not.toBe(assignmentSourceKey("y"));
    expect(assignmentSourceKey("x").startsWith("assignment:")).toBe(true);
  });
});
