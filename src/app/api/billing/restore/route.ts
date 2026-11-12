import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getBillingSummary } from "@/lib/entitlements";
import {
  canReadRevenueCat,
  getSubscriber,
  activeEntitlementIds,
  planForEntitlementIds,
  entitlementsForPlan,
  providerForStore,
} from "@/lib/revenuecat";
import { syncStripeSubscription } from "@/lib/subscriptions";
import { ok, fail, withRoute } from "@/lib/api";

/**
 * Restore purchases.
 *
 * This is how a subscription follows someone to a new device or platform: it
 * re-reads the truth from Stripe (and, failing that, from RevenueCat) and
 * rewrites our row, rather than trusting anything the client says it owns.
 *
 * Unlike checkout, this is allowed from the native app — restoring access is
 * not a purchase, so it does not fall under App Store 3.1.1.
 */
export const POST = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);

  const existing = await prisma.subscription.findUnique({ where: { userId: session.id } });
  let restored = false;
  let source: "stripe" | "revenuecat" | null = null;

  // ---- 1. Stripe, the payment source of truth -----------------------------
  if (isStripeConfigured() && stripe) {
    const customerId = existing?.stripeCustomerId ?? (await findCustomerId(session.id));

    if (customerId) {
      // `status: "all"` so a past_due or recently-cancelled subscription is
      // still found — those still carry access until the period ends.
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
      const best = pickMostRelevant(subs.data);
      if (best) {
        await syncStripeSubscription(best, session.id);
        restored = true;
        source = "stripe";
      } else if (!existing?.stripeCustomerId) {
        await prisma.subscription.upsert({
          where: { userId: session.id },
          create: { userId: session.id, stripeCustomerId: customerId },
          update: { stripeCustomerId: customerId },
        });
      }
    }
  }

  // ---- 2. RevenueCat, for a purchase made on another store ----------------
  // Only consulted when Stripe has nothing, since an App Store or Play
  // purchase has no Stripe record at all.
  if (!restored && canReadRevenueCat()) {
    const subscriber = await getSubscriber(session.id);
    const entitlementIds = activeEntitlementIds(subscriber);
    if (entitlementIds.length > 0) {
      const plan = planForEntitlementIds(entitlementIds);
      const storeEntry = Object.values(subscriber?.subscriptions ?? {})[0];
      const expires = storeEntry?.expires_date ? new Date(storeEntry.expires_date) : null;
      await prisma.subscription.upsert({
        where: { userId: session.id },
        create: {
          userId: session.id,
          plan,
          status: "active",
          provider: providerForStore(storeEntry?.store),
          entitlements: JSON.stringify(entitlementsForPlan(plan)),
          currentPeriodEnd: expires,
          revenueCatCustomerId: session.id,
          revenueCatSyncedAt: new Date(),
        },
        update: {
          plan,
          status: "active",
          provider: providerForStore(storeEntry?.store),
          entitlements: JSON.stringify(entitlementsForPlan(plan)),
          currentPeriodEnd: expires,
          revenueCatCustomerId: session.id,
          revenueCatSyncedAt: new Date(),
        },
      });
      restored = true;
      source = "revenuecat";
    }
  }

  const summary = await getBillingSummary(session.id);
  return ok({ restored, source, ...summary });
});

/** Find this user's Stripe customer when our own row has lost the id. */
async function findCustomerId(userId: string): Promise<string | null> {
  if (!stripe) return null;
  try {
    const found = await stripe.customers.search({ query: `metadata["userId"]:"${userId}"`, limit: 1 });
    return found.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Of a customer's subscriptions, the one that should own the account's access:
 * an entitling subscription first, otherwise the most recently created.
 */
function pickMostRelevant<T extends { status: string; created: number }>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const ranked = [...subs].sort((a, b) => {
    const rank = (s: string) => (s === "active" || s === "trialing" ? 0 : s === "past_due" ? 1 : 2);
    return rank(a.status) - rank(b.status) || b.created - a.created;
  });
  return ranked[0];
}
