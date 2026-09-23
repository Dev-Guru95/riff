import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, verifyPassword, clearSession } from "@/lib/auth";
import { deleteAccount, AccountDeletionError } from "@/lib/account";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  // Re-authentication. A session cookie alone is not enough to authorise
  // something irreversible: a borrowed or hijacked session would otherwise be
  // able to destroy the account outright.
  password: z.string().min(1),
  // Typed confirmation, so the request cannot be produced by a stray click or
  // a CSRF-style forged form post.
  confirm: z.literal("DELETE"),
});

export const DELETE = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const rl = rateLimit(`account-delete:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return fail("Account not found", 404);

  if (!(await verifyPassword(data.password, user.passwordHash))) {
    return fail("That password is not correct", 401);
  }

  try {
    const { orphanedSubscriptionId } = await deleteAccount(session.id);

    // The account is gone, so the JWT now points at nothing. Clear it rather
    // than leaving the browser holding a cookie for a deleted user.
    await clearSession();

    return ok({
      deleted: true,
      // Surfaced so a user whose billing could not be reached is told to check,
      // instead of quietly staying subscribed to a product they cannot open.
      billingNeedsAttention: !!orphanedSubscriptionId,
    });
  } catch (err) {
    // The only expected failure is the last-admin guard, which is a real
    // message worth showing rather than a generic 500.
    if (err instanceof AccountDeletionError) return fail(err.message, 409);
    throw err;
  }
});
