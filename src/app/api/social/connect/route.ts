import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SUPPORTED_PLATFORMS } from "@/lib/audit";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS),
  handle: z.string().min(1).max(64),
});

// Mock OAuth connect: in production this is the platform OAuth callback. Here we
// store the handle so the audit engine can track it month over month.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const account = await prisma.socialAccount.upsert({
    where: { userId_platform: { userId: session.id, platform: body.data.platform } },
    create: { userId: session.id, platform: body.data.platform, handle: body.data.handle, status: "active" },
    update: { handle: body.data.handle, status: "active" },
  });
  return ok({ id: account.id, platform: account.platform, handle: account.handle }, 201);
});

export const DELETE = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  if (!platform) return fail("platform required", 422);
  await prisma.socialAccount.deleteMany({ where: { userId: session.id, platform } });
  return ok({ success: true });
});
