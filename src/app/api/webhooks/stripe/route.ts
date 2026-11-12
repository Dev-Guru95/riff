import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import {
  syncStripeSubscription,
  syncStripeSubscriptionById,
  recordInvoice,
  markChargeRefunded,
  subscriptionIdForInvoice,
  withWebhookIdempotency,
} from "@/lib/subscriptions";

export const runtime = "nodejs";

/**
 * Stripe webhook — the only thing that may turn a payment into access.
 *
 * The signature is verified against the raw body before anything is read, so a
 * forged request cannot grant a subscription, and the browser's "payment
 * succeeded" redirect is never trusted: the success page only reads state that
 * this handler wrote.
 */
export async function POST(req: Request) {
  if (!stripe) return new Response("Billing not configured", { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  // Must be the raw body — any parsing first would break verification.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const outcome = await withWebhookIdempotency("stripe", event.id, event.type, () => handleEvent(event));
    if (outcome.duplicate) {
      console.log(`[stripe] ignoring duplicate delivery of ${event.type} (${event.id})`);
    }
  } catch (err) {
    console.error(`[stripe] handler error for ${event.type} (${event.id})`, err);
    // 500 asks Stripe to retry. The idempotency claim was released, so the
    // retry genuinely reprocesses rather than being treated as a duplicate.
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // ---- Checkout finished -------------------------------------------------
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;

      const userId = session.metadata?.userId || session.client_reference_id || null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;

      const before = userId
        ? await prisma.subscription.findUnique({ where: { userId }, select: { plan: true } })
        : null;

      const result = await syncStripeSubscriptionById(subscriptionId, userId);
      if (result && before?.plan !== result.plan && result.plan !== "free") {
        await notify(result.userId, {
          type: "reward",
          title: "🎉 Subscription active",
          body: "Welcome to your upgraded plan!",
          link: "/settings/billing",
        });
      }
      break;
    }

    // ---- Subscription lifecycle -------------------------------------------
    // Covers creation, upgrades and downgrades (the price on the item changes),
    // pausing, resuming, cancellation scheduled for period end, and deletion.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const result = await syncStripeSubscription(sub);
      if (result) {
        await notify(result.userId, {
          type: "system",
          title: "Subscription ended",
          body: "Your plan has ended and your account is back on Free.",
          link: "/pricing",
        });
      }
      break;
    }

    // ---- Renewals and payment outcomes ------------------------------------
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice, "paid");
      // A renewal moves the period end, so re-read the subscription rather than
      // inferring the new date from the invoice.
      const subscriptionId = subscriptionIdForInvoice(invoice);
      if (subscriptionId) await syncStripeSubscriptionById(subscriptionId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice, "failed");
      const subscriptionId = subscriptionIdForInvoice(invoice);
      if (subscriptionId) {
        const result = await syncStripeSubscriptionById(subscriptionId);
        if (result) {
          await notify(result.userId, {
            type: "system",
            title: "Payment failed",
            body: "We couldn't take payment for your plan. Update your card to keep your access.",
            link: "/settings/billing",
          });
        }
      }
      break;
    }

    case "charge.refunded": {
      await markChargeRefunded(event.data.object as Stripe.Charge);
      break;
    }

    default:
      // Everything else is acknowledged without action so Stripe stops retrying.
      break;
  }
}
