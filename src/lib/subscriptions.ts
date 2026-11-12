import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripe, planForSubscription, type PlanKey } from "./stripe";
import { pushStripeSubscription, entitlementsForPlan, isRevenueCatConfigured } from "./revenuecat";

/**
 * The one place subscription state is written.
 *
 * Every path that can change what a user is entitled to — Stripe webhooks, the
 * RevenueCat webhook, an explicit restore — funnels through here, so there is a
 * single definition of how a Stripe subscription becomes a row in our database
 * and an entitlement in RevenueCat. Writing this state from more than one place
 * is how conflicting subscription records happen.
 *
 * Everything here is idempotent: the state is derived wholly from the Stripe
 * object passed in, never from the previous row, so replaying an old webhook
 * cannot corrupt a newer state beyond briefly rewriting it with equal values.
 */

/**
 * The end of the current billing period.
 *
 * In current Stripe API versions this lives on the subscription *item*, not on
 * the subscription, so reading `sub.current_period_end` would silently yield
 * undefined and null out every renewal date.
 */
export function periodEndOf(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

function secondsToDate(ts: number | null | undefined): Date | null {
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Work out which of our users a Stripe subscription belongs to.
 *
 * Checked in order of reliability: the metadata we stamp on the subscription at
 * checkout, then our own record of the subscription or customer, and finally
 * the customer's metadata (which covers a subscription created by hand in the
 * Stripe dashboard).
 */
export async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.userId;
  if (fromMetadata) return fromMetadata;

  const bySubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { userId: true },
  });
  if (bySubscription) return bySubscription.userId;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const byCustomer = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  if (byCustomer) return byCustomer.userId;

  if (stripe) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.metadata?.userId) return customer.metadata.userId;
    } catch {
      // Customer may have been deleted in Stripe; fall through to null.
    }
  }
  return null;
}

export type SyncResult = {
  userId: string;
  plan: PlanKey;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  revenueCatSynced: boolean;
};

/**
 * Write a Stripe subscription into our database and mirror it to RevenueCat.
 *
 * `hintUserId` is used when the caller already knows the user (for example the
 * checkout session's `client_reference_id`) and the subscription metadata might
 * not have been written yet.
 */
export async function syncStripeSubscription(
  sub: Stripe.Subscription,
  hintUserId?: string | null,
): Promise<SyncResult | null> {
  const userId = hintUserId ?? (await resolveUserId(sub));
  if (!userId) {
    console.error(`[billing] could not map Stripe subscription ${sub.id} to a user`);
    return null;
  }

  const plan = planForSubscription(sub);
  const entitlements = entitlementsForPlan(plan);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const periodEnd = periodEndOf(sub);

  const data = {
    plan,
    status: sub.status,
    provider: "stripe",
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    entitlements: JSON.stringify(entitlements),
    startedAt: secondsToDate(sub.start_date),
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: secondsToDate(sub.canceled_at),
    endedAt: secondsToDate(sub.ended_at),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  // Mirror into RevenueCat so the entitlement follows the user to any other
  // platform they sign in from. A failure here must not fail the webhook: our
  // own row is already correct, Stripe would otherwise retry forever, and
  // `revenueCatSyncedAt` staying null is what /api/billing/restore repairs.
  let revenueCatSynced = false;
  if (isRevenueCatConfigured()) {
    const result = await pushStripeSubscription(userId, sub.id);
    if (result.ok) {
      revenueCatSynced = true;
      await prisma.subscription.update({
        where: { userId },
        data: { revenueCatCustomerId: userId, revenueCatSyncedAt: new Date() },
      });
    } else if (!("skipped" in result && result.skipped)) {
      console.error(`[billing] RevenueCat sync failed for user ${userId}: ${result.reason}`);
    }
  }

  return {
    userId,
    plan,
    status: sub.status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    revenueCatSynced,
  };
}

/** Re-read a subscription from Stripe by id and sync it. */
export async function syncStripeSubscriptionById(
  subscriptionId: string,
  hintUserId?: string | null,
): Promise<SyncResult | null> {
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return syncStripeSubscription(sub, hintUserId);
}

/** The subscription id an invoice was generated for, or null. */
export function subscriptionIdForInvoice(invoice: Stripe.Invoice): string | null {
  // Current API versions nest this under `parent`; `invoice.subscription` is gone.
  const details = invoice.parent?.subscription_details;
  const sub = details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * Record an invoice in the payment history.
 *
 * Keyed on the Stripe invoice id, so a retried webhook updates the existing row
 * instead of inserting a second one.
 */
export async function recordInvoice(
  invoice: Stripe.Invoice,
  status: "paid" | "failed",
): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!invoice.id) return;

  const sub = customerId
    ? await prisma.subscription.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true, userId: true },
      })
    : null;
  if (!sub) {
    console.error(`[billing] invoice ${invoice.id} has no matching subscription record`);
    return;
  }

  const amount = status === "paid" ? invoice.amount_paid : invoice.amount_due;
  const data = {
    userId: sub.userId,
    subscriptionId: sub.id,
    provider: "stripe",
    // Recorded when present so a later `charge.refunded` can find this row and
    // mark it refunded instead of filing a separate entry. Webhook payloads do
    // not expand `payments`, so this is best-effort.
    stripePaymentIntentId: paymentIntentIdOf(invoice),
    amount: amount ?? 0,
    currency: invoice.currency ?? "usd",
    status,
    description: invoice.billing_reason ?? "",
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    periodStart: secondsToDate(invoice.period_start),
    periodEnd: secondsToDate(invoice.period_end),
  };

  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: { stripeInvoiceId: invoice.id, ...data },
    update: { status, amount: data.amount, invoiceUrl: data.invoiceUrl },
  });
}

/** The PaymentIntent behind an invoice, when the payload carries it. */
function paymentIntentIdOf(invoice: Stripe.Invoice): string | null {
  const payment = invoice.payments?.data?.[0]?.payment;
  const pi = payment?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Mark the payment behind a refunded charge as refunded. */
export async function markChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;

  const existing = paymentIntentId
    ? await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })
    : null;

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { status: charge.amount_refunded >= charge.amount ? "refunded" : existing.status, stripeChargeId: charge.id },
    });
    return;
  }

  // No invoice row matched (for example a one-off charge). Record the refund so
  // the history is still complete rather than dropping it.
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return;
  const sub = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, userId: true },
  });
  if (!sub) return;

  await prisma.payment.create({
    data: {
      userId: sub.userId,
      subscriptionId: sub.id,
      provider: "stripe",
      stripeChargeId: charge.id,
      stripePaymentIntentId: paymentIntentId ?? null,
      amount: charge.amount_refunded,
      currency: charge.currency,
      status: "refunded",
      description: "refund",
    },
  });
}

/**
 * Run `fn` once per webhook event id.
 *
 * Stripe and RevenueCat both retry deliveries and both reuse the event id on a
 * retry. Claiming the id first means a duplicate delivery is a cheap no-op; if
 * the handler then throws, the claim is released so the provider's retry can
 * genuinely reprocess it rather than being swallowed forever.
 */
export async function withWebhookIdempotency<T>(
  provider: "stripe" | "revenuecat",
  eventId: string,
  type: string,
  fn: () => Promise<T>,
): Promise<{ duplicate: true } | { duplicate: false; result: T }> {
  try {
    await prisma.webhookEvent.create({ data: { provider, eventId, type } });
  } catch {
    // Unique violation on (provider, eventId) — already handled.
    return { duplicate: true };
  }

  try {
    const result = await fn();
    return { duplicate: false, result };
  } catch (err) {
    await prisma.webhookEvent
      .delete({ where: { provider_eventId: { provider, eventId } } })
      .catch(() => {});
    throw err;
  }
}
