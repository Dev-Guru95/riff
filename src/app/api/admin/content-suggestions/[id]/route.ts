import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ decision: z.enum(["approved", "rejected"]) });

// Approve or reject an AI-suggested content update.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const suggestion = await prisma.contentSuggestion.findUnique({ where: { id } });
  if (!suggestion) return fail("Suggestion not found", 404);
  if (suggestion.status !== "pending") return fail("Already reviewed", 409);

  const updated = await prisma.contentSuggestion.update({
    where: { id },
    data: { status: body.data.decision, reviewedById: session.id },
  });

  // On approval, bump the target course's version (signals content changed).
  if (body.data.decision === "approved" && suggestion.targetType === "lesson" && suggestion.targetId) {
    const lesson = await prisma.lesson.findUnique({ where: { id: suggestion.targetId }, include: { module: true } });
    if (lesson) await prisma.course.update({ where: { id: lesson.module.courseId }, data: { version: { increment: 1 } } });
  }

  await writeAudit(session.id, `content.${body.data.decision}`, "content_suggestion", id);
  return ok(updated);
});
