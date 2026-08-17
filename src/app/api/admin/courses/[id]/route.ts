import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { rollbackCourseRewards } from "@/lib/gamification";
import { parseBody, ok, fail } from "@/lib/api";
import {
  isSafeReturnUrl,
  normalizeReturnLabel,
  normalizeReturnUrl,
  RETURN_URL_MAX,
  RETURN_LABEL_MAX,
} from "@/lib/returnLink";

const schema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  isPublished: z.boolean().optional(),
  // Blank string is meaningful: it clears the override and restores the
  // community-root fallback. Protocol is checked below, not by zod — z.url()
  // accepts javascript: and this value ends up in an href.
  returnUrl: z.string().max(RETURN_URL_MAX).optional(),
  returnLabel: z.string().max(RETURN_LABEL_MAX).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return fail("Course not found", 404);

  const { returnUrl, returnLabel, ...rest } = body.data;
  const data: Record<string, unknown> = { ...rest };

  if (returnUrl !== undefined) {
    const normalized = normalizeReturnUrl(returnUrl);
    if (normalized && !isSafeReturnUrl(normalized)) {
      return fail("Return link must be a full http(s) URL, e.g. https://www.skool.com/…", 422);
    }
    data.returnUrl = normalized;
  }
  if (returnLabel !== undefined) data.returnLabel = normalizeReturnLabel(returnLabel);

  const updated = await prisma.course.update({ where: { id }, data });
  await writeAudit(session.id, "course.update", "course", id, data);
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  // Reverse earned XP first, otherwise the cascade orphans ledger rows (audit H3).
  await rollbackCourseRewards(id);
  await prisma.course.delete({ where: { id } });
  await writeAudit(session.id, "course.delete", "course", id);
  return ok({ success: true });
}
