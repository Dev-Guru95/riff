/**
 * Live test-mode exercise of the Stripe -> RevenueCat entitlement mirror.
 *
 * Creates a real Stripe sandbox subscription, pushes it to RevenueCat exactly
 * as the webhook path does, and reads the entitlements back. Cleans up after.
 */
import Stripe from "stripe";
import { planForSubscription } from "../src/lib/stripe";
import {
  pushStripeSubscription,
  getSubscriber,
  activeEntitlementIds,
  planForEntitlementIds,
  isRevenueCatConfigured,
  canReadRevenueCat,
} from "../src/lib/revenuecat";

const key = process.env.STRIPE_SECRET_KEY!;
if (!key.startsWith("sk_test_")) throw new Error("refusing to run outside Stripe test mode");
const stripe = new Stripe(key);

const PRO = process.env.STRIPE_PRICE_PRO!;
const PREMIUM = process.env.STRIPE_PRICE_PREMIUM!;

const results: string[] = [];
function check(name: string, pass: boolean, detail = "") {
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** RevenueCat ingests asynchronously; poll briefly rather than sleeping blindly. */
async function entitlementsEventually(appUserId: string, want: string, tries = 6): Promise<string[]> {
  let ids: string[] = [];
  for (let i = 0; i < tries; i++) {
    const sub = await getSubscriber(appUserId);
    ids = activeEntitlementIds(sub);
    if (ids.includes(want)) return ids;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return ids;
}

async function main() {
  check("RevenueCat push key configured", isRevenueCatConfigured());
  check("RevenueCat read key configured", canReadRevenueCat());
  if (!isRevenueCatConfigured()) {
    console.log(results.join("\n"));
    process.exitCode = 1;
    return;
  }

  const appUserId = "verify_rc_" + Date.now();
  let customerId: string | null = null;

  try {
    const customer = await stripe.customers.create({
      email: `verify+${Date.now()}@example.test`,
      metadata: { userId: appUserId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    });
    customerId = customer.id;

    // ---- Pro ---------------------------------------------------------------
    let sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: PRO }],
      metadata: { userId: appUserId, plan: "pro" },
    });

    const pushed = await pushStripeSubscription(appUserId, sub.id);
    check("push Stripe subscription to RevenueCat", pushed.ok, pushed.ok ? `entitlements=[${pushed.entitlementIds}]` : pushed.reason);

    if (pushed.ok) {
      check("push returns the pro entitlement", pushed.entitlementIds.includes("pro"), `[${pushed.entitlementIds}]`);
      check("plan resolves to pro", planForEntitlementIds(pushed.entitlementIds) === "pro", planForEntitlementIds(pushed.entitlementIds));
    }

    if (canReadRevenueCat()) {
      const ids = await entitlementsEventually(appUserId, "pro");
      check("subscriber readback shows pro", ids.includes("pro"), `[${ids}]`);
    }

    // ---- Upgrade to Premium ------------------------------------------------
    sub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: PREMIUM }],
      proration_behavior: "create_prorations",
      metadata: { userId: appUserId, plan: "premium" },
    });
    const upgraded = await pushStripeSubscription(appUserId, sub.id);
    check("push after upgrade", upgraded.ok, upgraded.ok ? `entitlements=[${upgraded.entitlementIds}]` : upgraded.reason);
    if (upgraded.ok) {
      check(
        "premium grants both entitlements",
        upgraded.entitlementIds.includes("premium") && upgraded.entitlementIds.includes("pro"),
        `[${upgraded.entitlementIds}]`,
      );
      check("plan resolves to premium", planForEntitlementIds(upgraded.entitlementIds) === "premium");
    }

    // ---- Cancel immediately ------------------------------------------------
    // RevenueCat keeps an entitlement until its own expiry date and its docs
    // say a Stripe cancellation can take up to two hours to surface. So the
    // thing worth asserting is NOT that RevenueCat has caught up — it is that
    // our own gate revokes access immediately from the Stripe object, which is
    // exactly why Stripe is treated as authoritative for Stripe-store events.
    const cancelledSub = await stripe.subscriptions.cancel(sub.id, { expand: ["items.data.price"] });
    const cancelled = await pushStripeSubscription(appUserId, sub.id);
    check("push after cancellation accepted", cancelled.ok, cancelled.ok ? `entitlements=[${cancelled.entitlementIds}]` : cancelled.reason);
    check(
      "our own gate revokes access immediately on cancellation",
      planForSubscription(cancelledSub) === "free",
      `planForSubscription=${planForSubscription(cancelledSub)}, status=${cancelledSub.status}`,
    );
    if (cancelled.ok) {
      results.push(
        `INFO  RevenueCat still reports [${cancelled.entitlementIds}] right after cancellation — expected lag (up to 2h). Access is not granted from this.`,
      );
    }

    // ---- Unknown subscription is rejected ----------------------------------
    const bogus = await pushStripeSubscription(appUserId, "sub_doesnotexist123");
    check("bogus subscription id is rejected", !bogus.ok, bogus.ok ? "accepted!" : "rejected as expected");
  } finally {
    if (customerId) {
      await stripe.customers.del(customerId).catch(() => {});
      results.push(`CLEANUP deleted Stripe test customer ${customerId}`);
    }
    results.push(`NOTE  RevenueCat sandbox customer "${appUserId}" remains in the project as test data.`);
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
