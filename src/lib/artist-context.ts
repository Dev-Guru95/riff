// ===== Action-step responses as artist context =====
//
// Every action step an artist completes ("Define your 'True Fan' avatar…",
// "Write your three brand pillars…") is a first-person statement about who they
// are and who they are making music for. That is exactly the material the AI
// coach needs, so a response is written to TWO places on submit:
//
//   Submission  — the artist's own record. What they wrote, when, and the AI
//                 review of it. Read back by the lesson UI so they can return
//                 and edit. This is the system of record.
//   CoachMemory — a distilled, weighted fact for AI retrieval. `ai-coach.ts`
//                 already pulls the top 12 memories by weight into the coach's
//                 context window, so an action step lands there with no change
//                 to the coach itself.
//
// Nothing here is specific to the True Fan avatar. Any assignment, on any track,
// present or future, flows through the same path — which is why the mapping
// below is keyed on the assignment's own text rather than on a hardcoded id.

import { prisma } from "./prisma";

/** The kinds `ai-coach.ts` understands. Adding one means teaching the coach. */
export const MEMORY_KINDS = ["goal", "genre", "audience", "insight", "preference"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/**
 * Action-step answers outrank memories inferred from chat: the artist wrote
 * this deliberately, as coursework, and it was reviewed. Weight drives the
 * coach's `orderBy`, so this keeps considered answers in context ahead of
 * offhand remarks when the window is full.
 */
export const ACTION_STEP_MEMORY_WEIGHT = 2;

/** Stable key so re-submitting an action step replaces its memory, not adds one. */
export function assignmentSourceKey(assignmentId: string): string {
  return `assignment:${assignmentId}`;
}

// Keyword → kind. Deliberately small and readable: the point is to route an
// answer into roughly the right bucket for retrieval, not to classify perfectly.
// Anything unmatched becomes an "insight", which the coach still reads.
const KIND_HINTS: { kind: MemoryKind; patterns: RegExp }[] = [
  { kind: "audience", patterns: /\b(fan|audience|listener|follower|demographic|avatar|persona)\b/i },
  { kind: "goal", patterns: /\b(goal|objective|target|milestone|ambition|plan for)\b/i },
  { kind: "genre", patterns: /\b(genre|sound|style|influence|sonic)\b/i },
  { kind: "preference", patterns: /\b(prefer|brand|voice|tone|aesthetic|identity|pillar)\b/i },
];

/**
 * Classify an action step from its own wording. Title and instructions are
 * checked together because the import pipeline sometimes lands the real title
 * inline in the instructions (see course-import/README.md).
 */
export function inferMemoryKind(assignment: { title: string; instructions: string }): MemoryKind {
  const haystack = `${assignment.title} ${assignment.instructions}`;
  return KIND_HINTS.find((h) => h.patterns.test(haystack))?.kind ?? "insight";
}

/**
 * Record (or replace) the artist-context memory for one action-step response.
 *
 * Idempotent per (user, assignment): editing an answer overwrites the previous
 * memory rather than leaving a stale contradiction in the coach's context.
 * Never throws into the request path — losing a memory must not fail a
 * submission the artist has already written.
 */
export async function recordActionStepMemory(
  userId: string,
  assignment: { id: string; title: string; instructions: string },
  text: string,
): Promise<void> {
  const content = text.trim();
  if (!content) return;
  try {
    const sourceKey = assignmentSourceKey(assignment.id);
    const kind = inferMemoryKind(assignment);
    // Prefixed with the prompt so the coach reads a self-contained fact rather
    // than an answer with no question attached.
    const body = `${assignment.title.trim()}: ${content}`;
    await prisma.coachMemory.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      create: { userId, sourceKey, kind, content: body, weight: ACTION_STEP_MEMORY_WEIGHT },
      update: { kind, content: body, weight: ACTION_STEP_MEMORY_WEIGHT, updatedAt: new Date() },
    });
  } catch (e) {
    console.error("[artist-context] failed to record action-step memory", e);
  }
}

export type ActionStepResponse = {
  assignmentId: string;
  assignmentTitle: string;
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
  text: string;
  status: string;
  aiScore: number | null;
  updatedAt: Date;
};

/**
 * Every action-step answer an artist has written, newest first — the structured
 * view for AI personalization (brand profile, audience targeting, content
 * generation). Kept separate from the raw Submission query so callers get track
 * and lesson context alongside the text without re-deriving it.
 */
export async function getActionStepResponses(userId: string): Promise<ActionStepResponse[]> {
  const rows = await prisma.submission.findMany({
    where: { userId, textContent: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      assignment: {
        include: {
          lesson: { include: { module: { include: { course: true } } } },
        },
      },
    },
  });

  // One entry per assignment: an edited answer supersedes the earlier attempt,
  // so only the newest submission per assignment describes the artist today.
  const seen = new Set<string>();
  const out: ActionStepResponse[] = [];
  for (const s of rows) {
    if (seen.has(s.assignmentId)) continue;
    seen.add(s.assignmentId);
    const course = s.assignment.lesson.module.course;
    out.push({
      assignmentId: s.assignmentId,
      assignmentTitle: s.assignment.title,
      courseSlug: course.slug,
      courseTitle: course.title,
      lessonTitle: s.assignment.lesson.title,
      text: s.textContent ?? "",
      status: s.status,
      aiScore: s.aiScore,
      updatedAt: s.createdAt,
    });
  }
  return out;
}

/** The artist's latest answer to one action step, or null if they've not done it. */
export async function getLatestResponse(userId: string, assignmentId: string) {
  return prisma.submission.findFirst({
    where: { userId, assignmentId },
    orderBy: { createdAt: "desc" },
  });
}
