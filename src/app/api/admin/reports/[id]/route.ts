import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";
import { removeReportedContent } from "@/lib/moderation";

const schema = z.object({ action: z.enum(["resolve", "dismiss", "delete_content"]) });

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { session, error } = await requireAdmin("moderator");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return fail("Report not found", 404);

  if (body.data.action === "delete_content") {
    // Remove the offending content, then mark resolved. What "remove" means per
    // target type lives in lib/moderation so this route and the two moderation
    // views cannot drift.
    await removeReportedContent(report.targetType, report.targetId);
  }

  const status = body.data.action === "dismiss" ? "dismissed" : "resolved";
  await prisma.report.update({ where: { id }, data: { status, reviewedById: session.id } });
  await writeAudit(session.id, `report.${body.data.action}`, "report", id, { targetType: report.targetType, targetId: report.targetId });
  return ok({ status });
});
