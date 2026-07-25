import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, planForPriceId } from "@/lib/stripe";
import { notify } from "@/lib/notifications";

export const runtime = "nodejs";

// Stripe webhook — keeps our Subscription rows in sync with Stripe. Verifies the
// signature so only Stripe can mutate billing state.
export async function POST(req: Request) {
  if (!stripe) return new Response("Billing not configured", { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, secret);
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId || s.client_reference_id;
        if (userId && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await syncSubscription(userId, sub);
          await notify(userId, { type: "reward", title: "🎉 Subscription active", body: "Welcome to your upgraded plan!", link: "/settings/billing" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForCustomer(sub.customer as string);
        if (userId) await syncSubscription(userId, sub);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe] handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  return sub?.userId ?? null;
}

async function syncSubscription(userId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = sub.status === "active" || sub.status === "trialing" ? planForPriceId(priceId) : "free";
  const periodEnd = sub.items.data[0]?.current_period_end;
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: sub.status,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    update: {
      plan,
      status: sub.status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}
