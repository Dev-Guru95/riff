// Studio "AI builder" tools: write text → get a 0-100 AI score + structured
// feedback (reusing src/lib/ai-review.ts, which works offline via a mock when no
// DEEPSEEK_API_KEY is set). Each builder is defined by a rubric + instructions.
import { prisma } from "@/lib/prisma";
import { reviewSubmission, type ReviewResult } from "@/lib/ai-review";

export type Builder = {
  kind: string;
  name: string;
  icon: string;
  track: number;
  tagline: string;
  placeholder: string;
  instructions: string;
  rubric: { criterion: string; weight: number }[];
};

export const BUILDERS: Builder[] = [
  {
    kind: "bio",
    name: "Bio & Brand Statement Builder",
    icon: "🪪",
    track: 1,
    tagline: "Write an artist bio or brand statement — get it scored and sharpened.",
    placeholder: "Write or paste your artist bio / brand statement here…",
    instructions:
      "Write a compelling artist bio / brand statement covering identity (who you are), aesthetic (how you look and sound), and voice (how you speak). It should be concise, memorable, and consistent across every platform.",
    rubric: [
      { criterion: "Clarity of identity & positioning", weight: 30 },
      { criterion: "Memorable hook / unique angle", weight: 25 },
      { criterion: "Consistency of voice & tone", weight: 20 },
      { criterion: "Professionalism & concision", weight: 25 },
    ],
  },
  {
    kind: "editorial_pitch",
    name: "Editorial Pitch Writer",
    icon: "🎧",
    track: 3,
    tagline: "Draft a Spotify editorial playlist pitch and get it scored.",
    placeholder: "Write your one-paragraph editorial pitch for your next single…",
    instructions:
      "Write a Spotify editorial playlist pitch (submitted via Spotify for Artists). One song, one clear story: the mood/genre, the story behind it, any momentum/traction, and why it fits the playlists you're targeting. Keep it to a short, specific, honest paragraph.",
    rubric: [
      { criterion: "Clear, compelling story", weight: 30 },
      { criterion: "Genre / mood specificity & fit", weight: 25 },
      { criterion: "Concision (fits the pitch limit)", weight: 25 },
      { criterion: "Traction / hook that earns attention", weight: 20 },
    ],
  },
];

export function builderFor(kind: string): Builder | null {
  return BUILDERS.find((b) => b.kind === kind) ?? null;
}

export type DraftDTO = {
  id: string;
  kind: string;
  title: string;
  content: string;
  score: number | null;
  feedback: ReviewResult | null;
  scoredAt: string | null;
  updatedAt: string;
};

type DraftRow = {
  id: string; kind: string; title: string; content: string;
  score: number | null; feedback: string; scoredAt: Date | null; updatedAt: Date;
};

function toDTO(d: DraftRow): DraftDTO {
  let feedback: ReviewResult | null = null;
  if (d.scoredAt) {
    try { feedback = JSON.parse(d.feedback) as ReviewResult; } catch { feedback = null; }
  }
  return {
    id: d.id, kind: d.kind, title: d.title, content: d.content,
    score: d.score, feedback, scoredAt: d.scoredAt?.toISOString() ?? null, updatedAt: d.updatedAt.toISOString(),
  };
}

export async function listDrafts(userId: string, kind: string): Promise<DraftDTO[]> {
  const rows = await prisma.aiDraft.findMany({ where: { userId, kind }, orderBy: { updatedAt: "desc" } });
  return rows.map(toDTO);
}

export async function createDraft(userId: string, kind: string, title: string): Promise<string> {
  const d = await prisma.aiDraft.create({ data: { userId, kind, title } });
  return d.id;
}

export async function getDraft(id: string, userId: string): Promise<DraftDTO | null> {
  const d = await prisma.aiDraft.findUnique({ where: { id } });
  if (!d || d.userId !== userId) return null;
  return toDTO(d);
}

export async function updateDraft(
  id: string,
  userId: string,
  data: { title?: string; content?: string },
): Promise<DraftDTO | null> {
  const d = await prisma.aiDraft.findUnique({ where: { id } });
  if (!d || d.userId !== userId) return null;
  const updated = await prisma.aiDraft.update({ where: { id }, data });
  return toDTO(updated);
}

export async function deleteDraft(id: string, userId: string): Promise<boolean> {
  const d = await prisma.aiDraft.findUnique({ where: { id }, select: { userId: true } });
  if (!d || d.userId !== userId) return false;
  await prisma.aiDraft.delete({ where: { id } });
  return true;
}

/** Run the AI reviewer over a draft's content and persist the score + feedback. */
export async function scoreDraft(id: string, userId: string): Promise<DraftDTO | null> {
  const d = await prisma.aiDraft.findUnique({ where: { id } });
  if (!d || d.userId !== userId) return null;
  const builder = builderFor(d.kind);
  if (!builder) return null;

  const result = await reviewSubmission({
    assignmentTitle: builder.name,
    instructions: builder.instructions,
    rubric: builder.rubric,
    artifactType: "text",
    textContent: d.content,
  });

  const updated = await prisma.aiDraft.update({
    where: { id },
    data: { score: result.score, feedback: JSON.stringify(result), scoredAt: new Date() },
  });
  return toDTO(updated);
}
