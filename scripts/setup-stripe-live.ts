/**
 * One-shot live-mode Stripe setup for Riff billing.
 *
 * Creates (or re-uses) the Pro and Premium products, their monthly *and
 * annual* prices, and the webhook endpoint, then prints the production
 * environment block.
 *
 * Amounts come from `src/lib/pricing.ts` — the same module the pricing page
 * and the checkout endpoint read — so Stripe cannot be configured with a
 * figure the app does not advertise.
 *
 * Stripe prices are immutable, so a price change means a *new* price object.
 * When the amount behind a lookup key has changed this script creates the new
 * price and transfers the lookup key to it, and deliberately leaves the old
 * price active: subscriptions already billing against it keep their original
 * amount, which is exactly what should happen to someone who subscribed at the
 * old price. New checkouts use the ids printed at the end.
 *
 * The BFCM launch-offer discount is NOT created here. It is a Stripe coupon
 * made on first use by `ensureCampaignCoupon()` in src/lib/coupons.ts, priced
 * as a fixed amount off so the charge equals the advertised offer price to the
 * cent. There is nothing to configure by hand for it.
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
import { LIST_PRICE_CENTS, PROMO, PROMO_PRICE_CENTS, type PaidPlanKey } from "../src/lib/pricing";

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

type PriceSpec = {
  plan: PaidPlanKey;
  interval: "monthly" | "annual";
  name: string;
  amount: number;
  lookupKey: string;
  /** The env var the printed id belongs in. */
  envVar: string;
};

const PLANS: PriceSpec[] = [
  { plan: "pro", interval: "monthly", name: "Riff Pro", amount: LIST_PRICE_CENTS.pro.monthly, lookupKey: "riff_pro_monthly", envVar: "STRIPE_PRICE_PRO" },
  { plan: "pro", interval: "annual", name: "Riff Pro", amount: LIST_PRICE_CENTS.pro.annual, lookupKey: "riff_pro_annual", envVar: "STRIPE_PRICE_PRO_ANNUAL" },
];
// Premium was withdrawn from the product. Its live prices are deliberately
// NOT archived here: archiving a price does not end a subscription billing
// against it, and leaving them active keeps any historical subscriber's
// renewals working. They simply are not created or sold any more.

const recurrenceFor = (interval: PriceSpec["interval"]): Stripe.PriceCreateParams.Recurring =>
  interval === "annual" ? { interval: "year" } : { interval: "month" };

/**
 * Find the product for a plan, so both of its prices hang off one product
 * rather than creating "Riff Pro" twice. Matched on the `plan` metadata this
 * script has always written.
 */
async function ensureProduct(spec: PriceSpec): Promise<string> {
  const search = await stripe.products.search({
    query: `active:'true' AND metadata['plan']:'${spec.plan}' AND metadata['app']:'riff'`,
    limit: 1,
  });
  if (search.data[0]) return search.data[0].id;

  const product = await stripe.products.create({
    name: spec.name,
    description: `${spec.name} plan`,
    // `plan` is the metadata `planForPrice()` falls back to when an env price
    // id has drifted — it is what keeps an old subscription resolvable.
    metadata: { plan: spec.plan, app: "riff" },
  });
  console.log(`  + ${spec.plan}: product ${product.id}`);
  return product.id;
}

async function ensurePrice(spec: PriceSpec): Promise<string> {
  const per = spec.interval === "annual" ? "yr" : "mo";
  // Lookup keys are unique per mode, so this is the reliable idempotency handle.
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
  const found = existing.data[0];

  if (found && found.unit_amount === spec.amount) {
    console.log(`  = ${spec.plan} ${spec.interval}: reusing price ${found.id} ($${spec.amount / 100}/${per})`);
    return found.id;
  }

  const productId = found?.product && typeof found.product === "string" ? found.product : await ensureProduct(spec);

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: spec.amount,
    currency: "usd",
    recurring: recurrenceFor(spec.interval),
    lookup_key: spec.lookupKey,
    // Transferring the key off the old price is what makes this re-runnable
    // after a price change; without it Stripe refuses the duplicate key.
    ...(found ? { transfer_lookup_key: true } : {}),
    metadata: { plan: spec.plan, interval: spec.interval },
  });

  if (found) {
    console.log(
      `  ~ ${spec.plan} ${spec.interval}: $${(found.unit_amount ?? 0) / 100} -> $${spec.amount / 100}/${per}` +
        ` (new price ${price.id}; ${found.id} left active so existing subscribers keep their price)`,
    );
  } else {
    console.log(`  + ${spec.plan} ${spec.interval}: price ${price.id} ($${spec.amount / 100}/${per})`);
    if (spec.interval === "monthly") await stripe.products.update(productId, { default_price: price.id });
  }
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
  for (const spec of PLANS) priceIds[spec.envVar] = await ensurePrice(spec);

  console.log("\nWebhook:");
  const secret = await ensureWebhook();

  console.log("\n" + "=".repeat(68));
  console.log("Production environment variables");
  console.log("=".repeat(68));
  console.log(`APP_URL="${APP_ORIGIN}"`);
  for (const spec of PLANS) console.log(`${spec.envVar}="${priceIds[spec.envVar]}"`);
  if (secret) {
    console.log(`STRIPE_WEBHOOK_SECRET="${secret}"`);
  } else {
    console.log(`STRIPE_WEBHOOK_SECRET="<reveal it on the endpoint in the Stripe dashboard>"`);
  }
  console.log(`STRIPE_SECRET_KEY="<create a full live secret key in the dashboard - do NOT reuse the restricted setup key>"`);
  console.log("=".repeat(68));
  console.log(
    `\n${PROMO.name}: nothing to configure here. While the campaign is live the app creates a` +
      `\nfixed-amount Stripe coupon on the first checkout (${PROMO.percentOff}% off: Pro at $${PROMO_PRICE_CENTS.pro.monthly / 100}/mo` +
      ` / $${PROMO_PRICE_CENTS.pro.annual / 100}/yr,` +
      ` / $${PROMO_PRICE_CENTS.pro.annual / 100}/yr).`,
  );
  console.log("\nThe restricted setup key is no longer needed - revoke it in the Stripe dashboard.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
