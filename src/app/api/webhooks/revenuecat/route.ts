import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import {
  verifyRevenueCatWebhook,
  planForEntitlementIds,
  entitlementsForPlan,
  providerForStore,
  stripeIsAuthoritative,
} from "@/lib/revenuecat";
import { syncStripeSubscriptionById, withWebhookIdempotency } from "@/lib/subscriptions";
import type { PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  environment?: string;
  store?: string;
  cancel_reason?: string;
};

/**
 * RevenueCat webhook — keeps entitlements consistent across platforms.
 *
 * Division of authority matters here. For a purchase whose store is Stripe,
 * Stripe is the source of truth and this handler only re-reads it (RevenueCat's
 * own docs note Stripe cancellations can take up to two hours to surface, so
 * trusting the payload could write stale state over fresh state). For an App
 * Store or Play purchase there is no Stripe record at all, so the event itself
 * is the authority and is written straight through.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  const verified = verifyRevenueCatWebhook(raw, {
    authorization: req.headers.get("authorization"),
    signature: req.headers.get("x-revenuecat-webhook-signature"),
  });
  if (!verified.ok) {
    console.error(`[revenuecat] rejected webhook: ${verified.reason}`);
    // 401 for a bad secret, 503 when none is configured — an endpoint that can
    // grant entitlements must never accept unauthenticated calls.
    const status = verified.reason.includes("not configured") ? 503 : 401;
    return new Response(verified.reason, { status });
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = body.event;
  if (!event?.id || !event.type) return new Response("Missing event", { status: 400 });

  try {
    const outcome = await withWebhookIdempotency("revenuecat", event.id, event.type, () => handleEvent(event));
    if (outcome.duplicate) {
      console.log(`[revenuecat] ignoring duplicate delivery of ${event.type} (${event.id})`);
    }
  } catch (err) {
    console.error(`[revenuecat] handler error for ${event.type} (${event.id})`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

/** Find the Riff user this event is about. App User ID is always our user id. */
async function resolveUser(event: RevenueCatEvent): Promise<string | null> {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
    (v): v is string => !!v,
  );
  for (const id of candidates) {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
}

async function handleEvent(event: RevenueCatEvent): Promise<void> {
  if (event.type === "TEST") {
    console.log("[revenuecat] test event received");
    return;
  }

  const userId = await resolveUser(event);
  if (!userId) {
    // Not an error: RevenueCat may carry subscribers that predate this app, and
    // retrying would never succeed.
    console.warn(`[revenuecat] no Riff user for app_user_id ${event.app_user_id ?? "(none)"}`);
    return;
  }

  // Stripe purchases: re-read Stripe instead of trusting the payload.
  if (stripeIsAuthoritative(event.store)) {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true },
    });
    if (sub?.stripeSubscriptionId) {
      await syncStripeSubscriptionById(sub.stripeSubscriptionId, userId);
    }
    return;
  }

  // App Store / Play Store / promotional: RevenueCat is the authority.
  await applyStoreEvent(userId, event);
}

/** Map a RevenueCat event type onto our subscription status. */
function statusForEventType(type: string): { status: string; cancelAtPeriodEnd?: boolean; ended?: boolean } | null {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "TEMPORARY_ENTITLEMENT_GRANT":
    case "NON_RENEWING_PURCHASE":
    case "PURCHASE_REDEEMED":
      return { status: "active", cancelAtPeriodEnd: false };
    case "CANCELLATION":
      // Still entitled until it expires — only auto-renew was switched off.
      return { status: "active", cancelAtPeriodEnd: true };
    case "SUBSCRIPTION_PAUSED":
      return { status: "paused", cancelAtPeriodEnd: true };
    case "BILLING_ISSUE":
      return { status: "past_due" };
    case "EXPIRATION":
      return { status: "canceled", ended: true };
    default:
      return null;
  }
}

async function applyStoreEvent(userId: string, event: RevenueCatEvent): Promise<void> {
  const mapped = statusForEventType(event.type ?? "");
  if (!mapped) {
    console.log(`[revenuecat] no action for event type ${event.type}`);
    return;
  }

  const entitlementIds = event.entitlement_ids ?? [];
  const planFromEntitlements = planForEntitlementIds(entitlementIds);
  // On expiry the event still names the entitlement that just lapsed, so the
  // plan has to come from the event type, not from entitlement_ids.
  const plan: PlanKey = mapped.ended ? "free" : planFromEntitlements;
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const now = new Date();

  const data = {
    plan,
    status: mapped.status,
    provider: providerForStore(event.store),
    entitlements: JSON.stringify(mapped.ended ? [] : entitlementsForPlan(plan)),
    currentPeriodEnd: expiresAt,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd ?? false,
    canceledAt: event.type === "CANCELLATION" ? now : undefined,
    endedAt: mapped.ended ? now : null,
    startedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms) : undefined,
    revenueCatCustomerId: userId,
    revenueCatSyncedAt: now,
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  if (event.type === "INITIAL_PURCHASE" && plan !== "free") {
    await notify(userId, {
      type: "reward",
      title: "🎉 Subscription active",
      body: "Welcome to your upgraded plan!",
      link: "/settings/billing",
    });
  } else if (event.type === "EXPIRATION") {
    await notify(userId, {
      type: "system",
      title: "Subscription ended",
      body: "Your plan has ended and your account is back on Free.",
      link: "/pricing",
    });
  } else if (event.type === "BILLING_ISSUE") {
    await notify(userId, {
      type: "system",
      title: "Payment failed",
      body: "We couldn't take payment for your plan. Update your payment method to keep your access.",
      link: "/settings/billing",
    });
  }
}
