/**
 * Create the four TEST-mode Stripe prices, for staging and local development.
 *
 * The test-mode counterpart of `setup-stripe-live.ts`, and the mirror image of
 * its safety check: this one refuses anything that is *not* a test key, so it
 * can never touch real money or real customers.
 *
 * Amounts come from `src/lib/pricing.ts`, so test mode and live mode cannot
 * drift apart.
 *
 *   npx tsx --env-file=.env scripts/setup-stripe-test.ts
 *
 * Prints the four STRIPE_PRICE_* lines on stdout (progress goes to stderr, so
 * `> prices.env` captures just the assignments).
 */
import Stripe from "stripe";
import { LIST_PRICE_CENTS, type BillingInterval, type PaidPlanKey } from "../src/lib/pricing";

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Pass --env-file=.env.");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error(
    "Refusing to run: STRIPE_SECRET_KEY is not a TEST key.\n" +
      "Live prices are created by scripts/setup-stripe-live.ts, which takes a restricted live key.",
  );
  process.exit(1);
}

const stripe = new Stripe(key);

type Spec = {
  plan: PaidPlanKey;
  interval: BillingInterval;
  name: string;
  amount: number;
  lookupKey: string;
  env: string;
};

const SPECS: Spec[] = [
  { plan: "pro", interval: "monthly", name: "Riff Pro", amount: LIST_PRICE_CENTS.pro.monthly, lookupKey: "riff_pro_monthly", env: "STRIPE_PRICE_PRO" },
  { plan: "pro", interval: "annual", name: "Riff Pro", amount: LIST_PRICE_CENTS.pro.annual, lookupKey: "riff_pro_annual", env: "STRIPE_PRICE_PRO_ANNUAL" },
];
// Premium was withdrawn from the product; only Free and Pro are sold.

/** One product per plan, matched on the `plan` metadata the app falls back to. */
async function productFor(spec: Spec): Promise<string> {
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['plan']:'${spec.plan}' AND metadata['app']:'riff'`,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe.products.create({
    name: spec.name,
    metadata: { plan: spec.plan, app: "riff" },
  });
  console.error(`  + product ${product.id} (${spec.plan})`);
  return product.id;
}

async function ensurePrice(spec: Spec): Promise<string> {
  const per = spec.interval === "annual" ? "yr" : "mo";
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
  const found = existing.data[0];

  if (found && found.unit_amount === spec.amount) {
    console.error(`  = ${spec.plan} ${spec.interval}: reusing ${found.id} ($${spec.amount / 100}/${per})`);
    return found.id;
  }

  const product = found && typeof found.product === "string" ? found.product : await productFor(spec);
  const price = await stripe.prices.create({
    product,
    unit_amount: spec.amount,
    currency: "usd",
    recurring: spec.interval === "annual" ? { interval: "year" } : { interval: "month" },
    lookup_key: spec.lookupKey,
    // Prices are immutable, so a changed amount means a new price. Moving the
    // lookup key onto it is what makes this re-runnable.
    ...(found ? { transfer_lookup_key: true } : {}),
    metadata: { plan: spec.plan, interval: spec.interval },
  });
  console.error(
    found
      ? `  ~ ${spec.plan} ${spec.interval}: $${(found.unit_amount ?? 0) / 100} -> $${spec.amount / 100}/${per} (${price.id})`
      : `  + ${spec.plan} ${spec.interval}: ${price.id} ($${spec.amount / 100}/${per})`,
  );
  return price.id;
}

async function main() {
  console.error("Configuring TEST-mode Stripe prices\n");
  const lines: string[] = [];
  for (const spec of SPECS) lines.push(`${spec.env}="${await ensurePrice(spec)}"`);
  console.error("");
  for (const line of lines) console.log(line);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
