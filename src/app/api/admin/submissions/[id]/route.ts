import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { recordAchievement } from "@/lib/events";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({
  aiScore: z.number().int().min(0).max(100),
  status: z.enum(["reviewed", "resubmit"]).default("reviewed"),
  note: z.string().optional(),
});

// Human override of an AI review (resolves flagged submissions).
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("reviewer");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const submission = await prisma.submission.findUnique({ where: { id }, include: { assignment: true } });
  if (!submission) return fail("Submission not found", 404);

  const updated = await prisma.submission.update({
    where: { id },
    data: { aiScore: body.data.aiScore, status: body.data.status, humanReviewed: true },
  });

  // On a human-confirmed pass, award assignment XP (idempotent per assignment).
  // No streak touch — this is a reviewer action, not the learner's own activity.
  let xp = null;
  if (body.data.status === "reviewed" && body.data.aiScore >= submission.assignment.minPassingScore) {
    const scaled = Math.round(submission.assignment.xpReward * (0.6 + 0.4 * (body.data.aiScore / 100)));
    const result = await recordAchievement({ userId: submission.userId, xp: scaled, source: "assignment", refId: submission.assignmentId, touchStreak: false });
    xp = result.xp;
  }

  await writeAudit(session.id, "submission.override", "submission", id, {
    score: body.data.aiScore,
    status: body.data.status,
    note: body.data.note,
  });
  return ok({ submission: updated, xp });
});
