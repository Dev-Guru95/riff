/**
 * Live test-mode exercise of the Stripe subscription lifecycle.
 *
 * Verifies the mapping functions against real Stripe objects (not fixtures),
 * then deletes everything it created. Test mode only.
 */
import Stripe from "stripe";
import { planForSubscription, planForPrice, statusGrantsAccess } from "../src/lib/stripe";

const key = process.env.STRIPE_SECRET_KEY!;
if (!key.startsWith("sk_test_")) throw new Error("refusing to run outside test mode");
const stripe = new Stripe(key);

const PRO = process.env.STRIPE_PRICE_PRO!;
const PREMIUM = process.env.STRIPE_PRICE_PREMIUM!;

function periodEndOf(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

const results: string[] = [];
function check(name: string, pass: boolean, detail = "") {
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const userId = "verify_user_" + Date.now();
  let customerId: string | null = null;

  try {
    // 1. Customer, as checkout would create it
    const customer = await stripe.customers.create({
      email: `verify+${Date.now()}@example.test`,
      metadata: { userId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;
    check("customer created with userId metadata", customer.metadata.userId === userId);

    // 2. Customer search by metadata (used by ensureCustomer + restore)
    //    Stripe's search index is eventually consistent, so this is reported
    //    rather than asserted.
    try {
      const found = await stripe.customers.search({ query: `metadata["userId"]:"${userId}"`, limit: 1 });
      check("customers.search by userId metadata reachable", true, `${found.data.length} hit(s) (index may lag)`);
    } catch (e) {
      check("customers.search by userId metadata reachable", false, String(e).slice(0, 80));
    }

    // 3. Subscribe to Pro
    let sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRO }],
      metadata: { userId, plan: "pro" },
      expand: ["items.data.price"],
    });
    check("subscription active after create", statusGrantsAccess(sub.status), `status=${sub.status}`);
    check("planForSubscription maps new sub to pro", planForSubscription(sub) === "pro", planForSubscription(sub));
    check("periodEndOf reads item.current_period_end", periodEndOf(sub) instanceof Date, String(periodEndOf(sub)));
    check("subscription carries userId metadata", sub.metadata.userId === userId);

    // 4. Price metadata fallback works without env price ids
    const priceObj = sub.items.data[0].price;
    check("planForPrice resolves via metadata/lookup", planForPrice(priceObj) === "pro", planForPrice(priceObj));

    // 5. Upgrade in place (what /api/billing/checkout does for an existing sub)
    sub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: PREMIUM }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: { userId, plan: "premium" },
      expand: ["items.data.price"],
    });
    check("upgrade in place maps to premium", planForSubscription(sub) === "premium", planForSubscription(sub));
    check("still a single subscription item", sub.items.data.length === 1, `${sub.items.data.length} item(s)`);

    // 6. Downgrade in place
    sub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: PRO }],
      proration_behavior: "create_prorations",
      expand: ["items.data.price"],
    });
    check("downgrade in place maps to pro", planForSubscription(sub) === "pro", planForSubscription(sub));

    // 7. Cancel at period end — access must continue
    sub = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    check("cancel_at_period_end set", sub.cancel_at_period_end === true);
    check("access retained while cancelling", planForSubscription(sub) === "pro", planForSubscription(sub));

    // 8. Uncancel
    sub = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    check("uncancel clears the flag", sub.cancel_at_period_end === false);

    // 9. Invoice shape — the renewal/payment-history path
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 1 });
    const inv = invoices.data[0];
    if (inv) {
      const parentSub = inv.parent?.subscription_details?.subscription;
      const subId = typeof parentSub === "string" ? parentSub : parentSub?.id;
      check("invoice.parent.subscription_details.subscription present", subId === sub.id, String(subId));
      check("invoice has amount + currency for payment history", typeof inv.amount_paid === "number" && !!inv.currency);
    } else {
      check("invoice created for subscription", false, "no invoice found");
    }

    // 10. Immediate cancellation revokes access
    const cancelled = await stripe.subscriptions.cancel(sub.id, { expand: ["items.data.price"] });
    check("cancelled status does not grant access", !statusGrantsAccess(cancelled.status), `status=${cancelled.status}`);
    check("planForSubscription drops to free", planForSubscription(cancelled) === "free", planForSubscription(cancelled));

    // 11. Webhook signature round-trip with the real endpoint secret
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const payload = JSON.stringify({ id: "evt_verify", object: "event", type: "customer.subscription.updated" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    try {
      const evt = stripe.webhooks.constructEvent(payload, header, secret);
      check("webhook signature verifies with configured secret", evt.id === "evt_verify");
    } catch (e) {
      check("webhook signature verifies with configured secret", false, String(e).slice(0, 80));
    }
    try {
      stripe.webhooks.constructEvent(payload, header, "whsec_wrong_secret");
      check("webhook rejects a wrong secret", false, "accepted a bad signature");
    } catch {
      check("webhook rejects a wrong secret", true);
    }
    try {
      stripe.webhooks.constructEvent(payload + " ", header, secret);
      check("webhook rejects a tampered body", false, "accepted tampered payload");
    } catch {
      check("webhook rejects a tampered body", true);
    }
  } finally {
    if (customerId) {
      await stripe.customers.del(customerId).catch(() => {});
      results.push(`CLEANUP deleted test customer ${customerId}`);
    }
  }

  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed.length} failed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
