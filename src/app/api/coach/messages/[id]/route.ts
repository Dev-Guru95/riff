import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ feedback: z.enum(["up", "down"]).nullable() });

// Coach response feedback loop (audit: missing). Used to measure coach quality.
export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const msg = await prisma.coachMessage.findUnique({ where: { id }, include: { thread: { select: { userId: true } } } });
  if (!msg || msg.thread.userId !== session.id) return fail("Message not found", 404);
  if (msg.role !== "assistant") return fail("Can only rate coach replies", 400);

  await prisma.coachMessage.update({ where: { id }, data: { feedback: body.data.feedback } });
  return ok({ feedback: body.data.feedback });
});
