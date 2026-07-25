import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

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
    // Remove the offending content, then mark resolved.
    if (report.targetType === "post") await prisma.post.deleteMany({ where: { id: report.targetId } });
    else if (report.targetType === "thread") await prisma.thread.deleteMany({ where: { id: report.targetId } });
    else if (report.targetType === "user") await prisma.user.updateMany({ where: { id: report.targetId }, data: { status: "suspended" } });
  }

  const status = body.data.action === "dismiss" ? "dismissed" : "resolved";
  await prisma.report.update({ where: { id }, data: { status, reviewedById: session.id } });
  await writeAudit(session.id, `report.${body.data.action}`, "report", id, { targetType: report.targetType, targetId: report.targetId });
  return ok({ status });
});
