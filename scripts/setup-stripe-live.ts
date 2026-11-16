/**
 * One-shot live-mode Stripe setup for Riff billing.
 *
 * Creates (or re-uses) the Pro and Premium products, their monthly prices, and
 * the webhook endpoint, then prints the production environment block.
 *
 * Run it with a *restricted* live key that can only write Products, Prices and
 * Webhook Endpoints — never the account's full secret key, and never from a
 * value stored in .env (local .env stays on test keys so `npm run dev` can
 * never touch real money):
 *
 *   STRIPE_LIVE_SETUP_KEY=rk_live_... npx tsx scripts/setup-stripe-live.ts
 *
 * Safe to run more than once: it looks products and prices up by lookup key
 * and the webhook up by URL before creating anything.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_LIVE_SETUP_KEY;
if (!key) {
  console.error("Set STRIPE_LIVE_SETUP_KEY to a restricted LIVE key (rk_live_...) and re-run.");
  process.exit(1);
}
if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) {
  console.error("That is a TEST key. This script configures live mode only.");
  process.exit(1);
}
if (key.startsWith("sk_live_")) {
  console.error(
    "Refusing to run with a FULL live secret key. Create a restricted key limited to\n" +
      "Products / Prices / Webhook Endpoints (write) and use that instead.",
  );
  process.exit(1);
}

const stripe = new Stripe(key);

const APP_ORIGIN = process.env.LIVE_APP_URL || "https://riffartists.com";
const WEBHOOK_URL = `${APP_ORIGIN}/api/webhooks/stripe`;

const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
];

const PLANS = [
  { plan: "pro", name: "Riff Pro", amount: 1900, lookupKey: "riff_pro_monthly" },
  { plan: "premium", name: "Riff Premium", amount: 3900, lookupKey: "riff_premium_monthly" },
] as const;

async function ensurePrice(spec: (typeof PLANS)[number]): Promise<string> {
  // Lookup keys are unique per mode, so this is the reliable idempotency handle.
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`  = ${spec.plan}: reusing existing price ${existing.data[0].id}`);
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: spec.name,
    description: `${spec.name} plan - monthly subscription`,
    metadata: { plan: spec.plan, app: "riff" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.amount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: spec.lookupKey,
    metadata: { plan: spec.plan },
  });
  await stripe.products.update(product.id, { default_price: price.id });
  console.log(`  + ${spec.plan}: product ${product.id}, price ${price.id} ($${spec.amount / 100}/mo)`);
  return price.id;
}

async function ensureWebhook(): Promise<string | null> {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((w) => w.url === WEBHOOK_URL);
  if (match) {
    // Make sure an endpoint created earlier still listens for everything we handle.
    const missing = EVENTS.filter((e) => !match.enabled_events.includes(e));
    if (missing.length) {
      await stripe.webhookEndpoints.update(match.id, { enabled_events: EVENTS });
      console.log(`  ~ webhook ${match.id}: added ${missing.length} missing event(s)`);
    } else {
      console.log(`  = webhook ${match.id}: already correct`);
    }
    // The signing secret is only ever returned at creation time.
    console.log("    (signing secret not shown again - reveal it in the Stripe dashboard)");
    return null;
  }

  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    description: "Riff app - subscription sync (live)",
    enabled_events: EVENTS,
  });
  console.log(`  + webhook ${created.id} -> ${WEBHOOK_URL} (${EVENTS.length} events)`);
  return created.secret ?? null;
}

async function main() {
  console.log(`Configuring LIVE Stripe for ${APP_ORIGIN}\n`);

  console.log("Products and prices:");
  const priceIds: Record<string, string> = {};
  for (const spec of PLANS) priceIds[spec.plan] = await ensurePrice(spec);

  console.log("\nWebhook:");
  const secret = await ensureWebhook();

  console.log("\n" + "=".repeat(68));
  console.log("Production environment variables");
  console.log("=".repeat(68));
  console.log(`APP_URL="${APP_ORIGIN}"`);
  console.log(`STRIPE_PRICE_PRO="${priceIds.pro}"`);
  console.log(`STRIPE_PRICE_PREMIUM="${priceIds.premium}"`);
  if (secret) {
    console.log(`STRIPE_WEBHOOK_SECRET="${secret}"`);
  } else {
    console.log(`STRIPE_WEBHOOK_SECRET="<reveal it on the endpoint in the Stripe dashboard>"`);
  }
  console.log(`STRIPE_SECRET_KEY="<create a full live secret key in the dashboard - do NOT reuse the restricted setup key>"`);
  console.log("=".repeat(68));
  console.log("\nThe restricted setup key is no longer needed - revoke it in the Stripe dashboard.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
