import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateMfaSecret, mfaKeyUri } from "@/lib/mfa";
import { ok, fail, withRoute } from "@/lib/api";

// Step 1: generate a pending secret (stored but not yet enabled). The client
// shows it for the user to add to their authenticator app, then calls /enable.
export const POST = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const secret = generateMfaSecret();
  await prisma.user.update({ where: { id: session.id }, data: { mfaSecret: secret, mfaEnabled: false } });
  return ok({ secret, otpauth: mfaKeyUri(session.email, secret) });
});
