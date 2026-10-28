import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { REPORT_TARGET_TYPES, REPORT_REASONS, composeReportReason } from "@/lib/constants";
import { resolveReportTarget } from "@/lib/moderation";

// POST /api/community/report — report content to the moderators. Reachable from
// the web and from the app (the stores require in-app reporting: Play for the
// AI Coach's replies, Apple for anything one artist writes that another reads).
//
// Either send a `reason` key from REPORT_REASONS with optional `detail`, or a
// free-text `reason` (what the old forum UI sent). Both end up as one string on
// Report.reason, so this needs no migration.
const reasonKeys = REPORT_REASONS.map((r) => r.key) as [string, ...string[]];

const schema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: z.string().min(1),
    reason: z.string().min(1).max(500),
    detail: z.string().max(500).optional(),
  })
  .transform((v) => ({
    ...v,
    reason: reasonKeys.includes(v.reason)
      ? composeReportReason(v.reason as (typeof REPORT_REASONS)[number]["key"], v.detail)
      : v.reason.trim(),
  }))
  .refine((v) => v.reason.length >= 3, { message: "Tell us what is wrong with it", path: ["reason"] });

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`report:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { targetType, targetId, reason } = body.data;

  // You may only report something you can actually see. Without this the route
  // would confirm whether an arbitrary id exists.
  const target = await resolveReportTarget(targetType, targetId, session.id);
  if (!target.ok) return fail("That content no longer exists", 404);

  // One open report per (reporter, target) — tapping twice is not two reports.
  const existing = await prisma.report.findFirst({
    where: { reporterId: session.id, targetType, targetId, status: "open" },
  });
  if (existing) return ok({ id: existing.id, duplicate: true, authorId: target.authorId });

  const report = await prisma.report.create({
    data: { reporterId: session.id, targetType, targetId, reason },
  });
  // `authorId` lets the client offer "block this artist" as the next step, and
  // is null when the content was written by the AI rather than a person.
  return ok({ id: report.id, duplicate: false, authorId: target.authorId }, 201);
});
