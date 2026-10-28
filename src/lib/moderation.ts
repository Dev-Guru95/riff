// Moderation: who may report what, what a moderator sees in the queue, and
// what "remove content" does per target type.
//
// Both stores require this to exist and to work from inside the app:
//   - Google Play's Generative AI policy wants in-app reporting of AI output
//     (here: `coach_message`).
//   - App Store guideline 1.2 wants reporting AND blocking wherever users see
//     content written by other users (here: `comment`, and `user` behind it).
//
// The report itself is written by POST /api/community/report and acted on by
// PATCH /api/admin/reports/[id]; this module is the shared middle so the two
// admin views and the two routes can never drift on what a target type means.

import { prisma } from "@/lib/prisma";
import { boardAccess } from "@/lib/boards";
import type { ReportTargetType } from "@/lib/constants";

/** One line of context per target, shown to moderators in place of the raw id. */
export async function reportPreview(targetType: string, targetId: string): Promise<string> {
  switch (targetType) {
    case "post":
      return (await prisma.post.findUnique({ where: { id: targetId }, select: { body: true } }))?.body ?? "(deleted)";
    case "thread":
      return (await prisma.thread.findUnique({ where: { id: targetId }, select: { title: true } }))?.title ?? "(deleted)";
    case "comment":
      return (await prisma.comment.findUnique({ where: { id: targetId }, select: { body: true } }))?.body ?? "(deleted)";
    case "coach_message": {
      const m = await prisma.coachMessage.findUnique({
        where: { id: targetId },
        select: { content: true, role: true },
      });
      if (!m) return "(deleted)";
      // Label it, because a moderator triaging this queue needs to know at a
      // glance whether they are reading the model or the person prompting it.
      return `${m.role === "assistant" ? "AI Coach" : "Artist"}: ${m.content}`;
    }
    default:
      return (await prisma.user.findUnique({ where: { id: targetId }, select: { email: true } }))?.email ?? "(deleted)";
  }
}

/**
 * Can this person see the thing they are reporting?
 *
 * Without the check, the report endpoint would confirm whether any given id
 * exists, and would let anyone fill the moderation queue with targets they have
 * never seen. Returns the target's author where there is one, so the caller can
 * offer "block this artist" next.
 */
export async function resolveReportTarget(
  targetType: ReportTargetType,
  targetId: string,
  userId: string,
): Promise<{ ok: true; authorId: string | null } | { ok: false }> {
  switch (targetType) {
    case "coach_message": {
      // A coach thread is private to one artist: you may only report your own.
      const message = await prisma.coachMessage.findUnique({
        where: { id: targetId },
        select: { thread: { select: { userId: true } } },
      });
      if (!message || message.thread.userId !== userId) return { ok: false };
      // The author is the model, not a person — nobody to block.
      return { ok: true, authorId: null };
    }
    case "comment": {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { userId: true, card: { select: { boardId: true } } },
      });
      if (!comment) return { ok: false };
      if (!(await boardAccess(comment.card.boardId, userId))) return { ok: false };
      return { ok: true, authorId: comment.userId };
    }
    case "user": {
      const exists = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!exists || targetId === userId) return { ok: false };
      return { ok: true, authorId: targetId };
    }
    case "post": {
      const post = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true } });
      return post ? { ok: true, authorId: post.userId } : { ok: false };
    }
    case "thread": {
      const thread = await prisma.thread.findUnique({ where: { id: targetId }, select: { userId: true } });
      return thread ? { ok: true, authorId: thread.userId } : { ok: false };
    }
  }
}

/** What a moderator's "Remove content" action does, per target type. */
export async function removeReportedContent(targetType: string, targetId: string): Promise<void> {
  switch (targetType) {
    case "post":
      await prisma.post.deleteMany({ where: { id: targetId } });
      return;
    case "thread":
      await prisma.thread.deleteMany({ where: { id: targetId } });
      return;
    case "comment":
      await prisma.comment.deleteMany({ where: { id: targetId } });
      return;
    case "coach_message":
      // The reply is the model's, generated for one artist. Removing it clears
      // the text but keeps the row, so the thread it belongs to still reads in
      // order and the feedback loop keeps a record that it was taken down.
      await prisma.coachMessage.updateMany({
        where: { id: targetId },
        data: { content: "(removed by a moderator)" },
      });
      return;
    default:
      await prisma.user.updateMany({ where: { id: targetId }, data: { status: "suspended" } });
  }
}
