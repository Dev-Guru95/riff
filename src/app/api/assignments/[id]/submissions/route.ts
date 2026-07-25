import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAchievement } from "@/lib/events";
import type { SharePayload } from "@/lib/share";
import { reviewSubmission } from "@/lib/ai-review";
import { track } from "@/lib/analytics";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  artifactType: z.enum(["text", "link", "image", "audio", "video", "pdf"]).default("text"),
  textContent: z.string().optional(),
  externalLink: z.string().url().optional(),
  artifactUrls: z.array(z.string().url()).optional(),
});

// Below this AI confidence we don't auto-finalize — flag for human review.
const CONFIDENCE_GATE = 0.5;

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`ai:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const { id } = await params;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  if (!data.textContent && !data.externalLink && !(data.artifactUrls?.length)) {
    return fail("Provide text, a link, or an uploaded file", 422);
  }

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) return fail("Assignment not found", 404);

  // Create in processing state first (mirrors the async pipeline).
  const submission = await prisma.submission.create({
    data: {
      userId: session.id,
      assignmentId: id,
      artifactType: data.artifactType,
      textContent: data.textContent,
      externalLink: data.externalLink,
      artifactUrls: JSON.stringify(data.artifactUrls ?? []),
      status: "processing",
    },
  });

  // AI review (mock fallback if no API key). In production this runs in a worker.
  const review = await reviewSubmission({
    assignmentTitle: assignment.title,
    instructions: assignment.instructions,
    rubric: JSON.parse(assignment.rubric),
    artifactType: data.artifactType,
    textContent: data.textContent,
    externalLink: data.externalLink,
    artifactUrls: data.artifactUrls,
  });

  const lowConfidence = review.confidence < CONFIDENCE_GATE;
  const passed = review.score >= assignment.minPassingScore;
  const status = lowConfidence ? "flagged" : "reviewed";

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status,
      aiScore: review.score,
      strengths: JSON.stringify(review.strengths),
      weaknesses: JSON.stringify(review.weaknesses),
      recommendations: JSON.stringify(review.recommendations),
      nextActions: JSON.stringify(review.nextActions),
      confidence: review.confidence,
    },
  });

  // Award XP only on a confident pass, idempotent per assignment.
  let xp = null;
  let streak = null;
  let shares: SharePayload[] | undefined;
  if (!lowConfidence && passed) {
    const scaled = Math.round(assignment.xpReward * (0.6 + 0.4 * (review.score / 100)));
    const result = await recordAchievement({ userId: session.id, xp: scaled, source: "assignment", refId: id });
    xp = result.xp;
    streak = result.streak;
    shares = result.shares;
  }
  await track("assignment_submit", session.id, { assignmentId: id, score: review.score, status });

  return ok({
    submissionId: updated.id,
    status,
    review,
    passed,
    flaggedForHumanReview: lowConfidence,
    xp,
    streak,
    shares,
  });
});
