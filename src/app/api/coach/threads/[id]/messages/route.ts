import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildCoachContext, coachReply } from "@/lib/ai-coach";
import { track } from "@/lib/analytics";
import { withinCoachQuota } from "@/lib/entitlements";
import { isSkoolMember } from "@/lib/community";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({ content: z.string().min(1).max(2000) });

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  // Community gate: AI Coach requires Skool membership.
  if (!(await isSkoolMember(session.id))) {
    return fail("Join the Skool community to unlock the AI Coach.", 403, { reason: "community_required" });
  }
  const rl = rateLimit(`ai:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  // Plan gate: free tier has a daily coach-message quota.
  if (!(await withinCoachQuota(session.id))) {
    return fail("Daily coach limit reached on your plan. Upgrade for unlimited coaching.", 402);
  }
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const thread = await prisma.coachThread.findUnique({ where: { id } });
  if (!thread || thread.userId !== session.id) return fail("Thread not found", 404);

  // Store the user message.
  await prisma.coachMessage.create({ data: { threadId: id, role: "user", content: body.data.content } });

  // Title the thread from the first message.
  const count = await prisma.coachMessage.count({ where: { threadId: id, role: "user" } });
  if (count === 1) {
    await prisma.coachThread.update({
      where: { id },
      data: { title: body.data.content.slice(0, 48) },
    });
  }

  // Assemble personalized context + recent history, then generate a reply.
  const ctx = await buildCoachContext(session.id);
  const history = await prisma.coachMessage.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const reply = await coachReply(
    ctx,
    history.map((m) => ({ role: m.role, content: m.content })),
    body.data.content,
  );

  const assistantMsg = await prisma.coachMessage.create({
    data: { threadId: id, role: "assistant", content: reply },
  });

  // Lightweight memory write: capture explicit goals the artist states.
  if (/my goal|i want to|i'm trying to|i am trying to/i.test(body.data.content)) {
    await prisma.coachMemory.create({
      data: { userId: session.id, kind: "goal", content: body.data.content.slice(0, 200), weight: 3 },
    });
  }

  await track("coach_message", session.id, { threadId: id });

  // Stream the (already-persisted) reply back as SSE so the UI renders it
  // progressively. True token-by-token provider streaming is a later refinement;
  // chunking here gives the same UX and works with the offline mock.
  const encoder = new TextEncoder();
  const words = reply.split(/(\s+)/); // keep whitespace tokens
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: assistantMsg.id })}\n\n`));
      for (const w of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: w })}\n\n`));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
});

export const GET = withRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const thread = await prisma.coachThread.findUnique({ where: { id } });
  if (!thread || thread.userId !== session.id) return fail("Thread not found", 404);
  const messages = await prisma.coachMessage.findMany({ where: { threadId: id }, orderBy: { createdAt: "asc" } });
  return ok({ messages });
});
