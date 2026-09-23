import { prisma } from "./prisma";
import { stripe } from "./stripe";

/**
 * Permanent account deletion.
 *
 * Google Play (and Apple, and GDPR Art. 17) require an account that can be
 * created to also be deletable, from inside the app and from a public web page.
 *
 * Almost every table hangs off User with `onDelete: Cascade`, so a single
 * `user.delete()` clears the bulk of it. Six tables do NOT, because they store
 * `userId` as a plain String with no relation — Prisma cannot cascade what it
 * does not know is a foreign key, so those rows would silently survive the
 * delete and keep personal data about someone who asked to be forgotten. They
 * are removed explicitly below. Anything added later that stores a bare userId
 * must be added here too.
 */

export class AccountDeletionError extends Error {}

/**
 * Cancel a live Stripe subscription so deleting the account does not leave the
 * person being billed for something they can no longer access.
 *
 * Deliberately best-effort: Stripe being unreachable must not block someone
 * from exercising a legal right to erasure. A failure is logged loudly so it
 * can be reconciled, and deletion continues.
 */
async function cancelSubscription(userId: string): Promise<string | null> {
  if (!stripe) return null;

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeSubscriptionId) return null;

  try {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    return null;
  } catch (err) {
    console.error(
      `[account] FAILED to cancel Stripe subscription ${sub.stripeSubscriptionId} ` +
        `for deleted user ${userId} — cancel it manually in the Stripe dashboard:`,
      err,
    );
    return sub.stripeSubscriptionId;
  }
}

/**
 * Deletes the user and everything belonging to them.
 *
 * Returns the id of a Stripe subscription that could not be cancelled, if any,
 * so the caller can surface it for manual reconciliation.
 */
export async function deleteAccount(userId: string): Promise<{ orphanedSubscriptionId: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new AccountDeletionError("Account not found");

  // Deleting the last administrator would lock everyone out of the admin area
  // with no way back in short of database surgery.
  if (user.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      throw new AccountDeletionError(
        "This is the only admin account. Promote another admin before deleting it.",
      );
    }
  }

  const orphanedSubscriptionId = await cancelSubscription(userId);

  await prisma.$transaction([
    // --- the six tables that cannot cascade (bare userId, no relation) ---
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.analyticsEvent.deleteMany({ where: { userId } }),
    prisma.couponRedemption.deleteMany({ where: { userId } }),
    prisma.leaderboardSnapshot.deleteMany({ where: { userId } }),
    // Moderation records reference people by id in three different columns.
    prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: userId },
          { reviewedById: userId },
          { targetType: "user", targetId: userId },
        ],
      },
    }),
    prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    }),

    // --- everything else goes with the user via onDelete: Cascade ---
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return { orphanedSubscriptionId };
}
