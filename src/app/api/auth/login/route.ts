import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSession, isNativeClient } from "@/lib/auth";
import { verifyMfaCode } from "@/lib/mfa";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1), code: z.string().optional() });

export const POST = withRoute(async (req: Request) => {
  // Brute-force protection: cap attempts per IP.
  const rl = rateLimit(`login:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    return fail("Invalid email or password", 401);
  }
  if (user.status !== "active") return fail("Account is not active", 403);

  // Second factor: if enabled, a valid TOTP code is required before a session is issued.
  if (user.mfaEnabled && user.mfaSecret) {
    if (!data.code) return ok({ mfaRequired: true });
    if (!verifyMfaCode(data.code, user.mfaSecret)) return fail("Invalid authentication code", 401);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  const token = await setSession({ id: user.id, email: user.email, role: user.role });
  return ok({ id: user.id, email: user.email, role: user.role, ...(isNativeClient(req) ? { token } : {}) });
});
