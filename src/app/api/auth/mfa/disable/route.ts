import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { verifyMfaCode } from "@/lib/mfa";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ code: z.string().min(6).max(8) });

// Disable MFA — requires a valid current code.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.mfaEnabled || !user.mfaSecret) return fail("MFA is not enabled", 400);
  if (!verifyMfaCode(body.data.code, user.mfaSecret)) return fail("Invalid code", 401);

  await prisma.user.update({ where: { id: session.id }, data: { mfaEnabled: false, mfaSecret: null } });
  return ok({ enabled: false });
});
