import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";

/**
 * Password reset tokens.
 *
 * The token is a 32-byte random value shown only once, in the email. Only its
 * SHA-256 is stored, so a leaked database backup cannot be replayed into
 * account takeovers. Tokens are single-use and short-lived, and requesting a
 * new one invalidates any outstanding ones.
 */
export const RESET_TOKEN_TTL_MINUTES = 60;
/** bcrypt silently truncates past 72 bytes, so cap input rather than appear to accept more. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Issue a reset token for a user and return the raw value to email.
 * Any outstanding tokens for the user are consumed first: a password reset
 * email should invalidate the previous one.
 */
export async function issueResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export type ResetOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "weak" };

/**
 * Consume a token and set the new password.
 *
 * Returns a deliberately coarse reason: the caller shows "this link is no
 * longer valid" for all of invalid/expired/used, so probing a token tells an
 * attacker nothing about whether it ever existed.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<ResetOutcome> {
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return { ok: false, reason: "weak" };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true, tokenHash: true },
  });
  if (!record) return { ok: false, reason: "invalid" };

  // The lookup above is already an equality match on a hash, but compare again
  // in constant time so timing cannot distinguish a near-miss from a miss.
  const given = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(record.tokenHash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return { ok: false, reason: "invalid" };
  }

  if (record.consumedAt) return { ok: false, reason: "used" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const passwordHash = await hashPassword(newPassword);

  // Consume the token and change the password together: if either fails,
  // neither happens, so a token can never be spent without a password change.
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Any other outstanding token is now stale.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId };
}

/** Housekeeping: drop tokens that expired a while ago. */
export async function purgeExpiredResetTokens(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const { count } = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return count;
}
