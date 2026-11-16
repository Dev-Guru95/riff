import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";
import { planFromSubscription } from "./entitlements";
import { planForPrice, planForSubscription, statusGrantsAccess, planRank, PLANS } from "./stripe";
import {
  verifyRevenueCatWebhook,
  planForEntitlementIds,
  activeEntitlementIds,
  providerForStore,
  stripeIsAuthoritative,
  entitlementsForPlan,
  grantPromotionalEntitlement,
} from "./revenuecat";
import { periodEndOf, subscriptionIdForInvoice } from "./subscriptions";
import { createHmac } from "node:crypto";

// ───────────────────────── access rule ─────────────────────────

describe("planFromSubscription", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it("gives free when there is no subscription at all", () => {
    expect(planFromSubscription(null)).toBe("free");
    expect(planFromSubscription(undefined)).toBe("free");
  });

  it("grants the plan while active or trialing", () => {
    expect(planFromSubscription({ plan: "pro", status: "active", currentPeriodEnd: future })).toBe("pro");
    expect(planFromSubscription({ plan: "premium", status: "trialing", currentPeriodEnd: future })).toBe("premium");
  });

  it("revokes access once cancelled or incomplete", () => {
    expect(planFromSubscription({ plan: "pro", status: "canceled", currentPeriodEnd: future })).toBe("free");
    expect(planFromSubscription({ plan: "pro", status: "incomplete", currentPeriodEnd: future })).toBe("free");
  });

  it("keeps access through a billing retry until the paid period ends", () => {
    // Stripe holds a subscription at past_due while it retries the card. Cutting
    // access off immediately would lock out someone who has already paid for
    // this period.
    expect(planFromSubscription({ plan: "pro", status: "past_due", currentPeriodEnd: future })).toBe("pro");
    expect(planFromSubscription({ plan: "pro", status: "unpaid", currentPeriodEnd: future })).toBe("pro");
  });

  it("drops access when the retry window has run out", () => {
    expect(planFromSubscription({ plan: "pro", status: "past_due", currentPeriodEnd: past })).toBe("free");
    expect(planFromSubscription({ plan: "pro", status: "past_due", currentPeriodEnd: null })).toBe("free");
  });

  it("never promotes an unknown plan string", () => {
    expect(planFromSubscription({ plan: "enterprise", status: "active", currentPeriodEnd: future })).toBe("free");
  });
});

// ───────────────────────── price → plan ─────────────────────────

describe("planForPrice", () => {
  const price = (over: Partial<Stripe.Price>): Stripe.Price => ({ id: "price_x", metadata: {}, ...over }) as Stripe.Price;

  it("reads the plan from price metadata", () => {
    expect(planForPrice(price({ metadata: { plan: "premium" } }))).toBe("premium");
    expect(planForPrice(price({ metadata: { plan: "pro" } }))).toBe("pro");
  });

  it("falls back to the expanded product's metadata", () => {
    const p = price({ metadata: {}, product: { metadata: { plan: "premium" } } as unknown as Stripe.Product });
    expect(planForPrice(p)).toBe("premium");
  });

  it("falls back to the lookup key", () => {
    expect(planForPrice(price({ metadata: {}, lookup_key: PLANS.pro.lookupKey! }))).toBe("pro");
    expect(planForPrice(price({ metadata: {}, lookup_key: PLANS.premium.lookupKey! }))).toBe("premium");
  });

  it("gives free for an unknown price rather than guessing", () => {
    expect(planForPrice(price({ metadata: {}, lookup_key: "something_else" }))).toBe("free");
    expect(planForPrice(null)).toBe("free");
  });
});

describe("planForSubscription", () => {
  const subWith = (status: string): Stripe.Subscription =>
    ({ status, items: { data: [{ price: { id: "p", metadata: { plan: "pro" } } }] } }) as unknown as Stripe.Subscription;

  it("resolves the plan for an entitling status", () => {
    expect(planForSubscription(subWith("active"))).toBe("pro");
    expect(planForSubscription(subWith("trialing"))).toBe("pro");
  });

  it("returns free for a status that does not entitle, whatever the price says", () => {
    expect(planForSubscription(subWith("canceled"))).toBe("free");
    expect(planForSubscription(subWith("past_due"))).toBe("free");
  });
});

describe("statusGrantsAccess / planRank", () => {
  it("only active and trialing grant access", () => {
    expect(statusGrantsAccess("active")).toBe(true);
    expect(statusGrantsAccess("trialing")).toBe(true);
    expect(statusGrantsAccess("past_due")).toBe(false);
    expect(statusGrantsAccess(null)).toBe(false);
  });

  it("ranks plans so upgrades can be told from downgrades", () => {
    expect(planRank("premium")).toBeGreaterThan(planRank("pro"));
    expect(planRank("pro")).toBeGreaterThan(planRank("free"));
  });
});

// ───────────────────────── Stripe object shapes ─────────────────────────

describe("periodEndOf", () => {
  it("reads current_period_end from the subscription item", () => {
    // Current Stripe API versions moved this off the subscription; reading the
    // top level would silently null out every renewal date.
    const sub = { items: { data: [{ current_period_end: 1_700_000_000 }] } } as unknown as Stripe.Subscription;
    expect(periodEndOf(sub)).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("is null when there is no item", () => {
    expect(periodEndOf({ items: { data: [] } } as unknown as Stripe.Subscription)).toBeNull();
  });
});

describe("subscriptionIdForInvoice", () => {
  it("reads the subscription out of invoice.parent", () => {
    const invoice = {
      parent: { subscription_details: { subscription: "sub_123" } },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdForInvoice(invoice)).toBe("sub_123");
  });

  it("handles an expanded subscription object and a missing parent", () => {
    const expanded = {
      parent: { subscription_details: { subscription: { id: "sub_456" } } },
    } as unknown as Stripe.Invoice;
    expect(subscriptionIdForInvoice(expanded)).toBe("sub_456");
    expect(subscriptionIdForInvoice({ parent: null } as unknown as Stripe.Invoice)).toBeNull();
  });
});

// ───────────────────────── RevenueCat ─────────────────────────

describe("planForEntitlementIds", () => {
  it("takes the highest entitlement held", () => {
    expect(planForEntitlementIds(["pro", "premium"])).toBe("premium");
    expect(planForEntitlementIds(["pro"])).toBe("pro");
    expect(planForEntitlementIds([])).toBe("free");
    expect(planForEntitlementIds(["unknown"])).toBe("free");
  });

  it("round-trips with the entitlements a plan grants", () => {
    expect(planForEntitlementIds(entitlementsForPlan("premium"))).toBe("premium");
    expect(planForEntitlementIds(entitlementsForPlan("pro"))).toBe("pro");
    expect(planForEntitlementIds(entitlementsForPlan("free"))).toBe("free");
  });
});

describe("activeEntitlementIds", () => {
  it("keeps unexpired and lifetime entitlements, drops expired ones", () => {
    const ids = activeEntitlementIds({
      entitlements: {
        pro: { expires_date: new Date(Date.now() + 86_400_000).toISOString() },
        old: { expires_date: new Date(Date.now() - 86_400_000).toISOString() },
        lifetime: { expires_date: null },
      },
    });
    expect(ids.sort()).toEqual(["lifetime", "pro"]);
  });

  it("is empty for an unknown subscriber", () => {
    expect(activeEntitlementIds(null)).toEqual([]);
    expect(activeEntitlementIds({})).toEqual([]);
  });
});

describe("providerForStore / stripeIsAuthoritative", () => {
  it("maps RevenueCat stores onto our provider values", () => {
    expect(providerForStore("APP_STORE")).toBe("app_store");
    expect(providerForStore("PLAY_STORE")).toBe("play_store");
    expect(providerForStore("STRIPE")).toBe("stripe");
    expect(providerForStore("PROMOTIONAL")).toBe("promo");
  });

  it("treats only Stripe-store events as Stripe-authoritative", () => {
    expect(stripeIsAuthoritative("STRIPE")).toBe(true);
    expect(stripeIsAuthoritative("APP_STORE")).toBe(false);
    expect(stripeIsAuthoritative(undefined)).toBe(false);
  });
});

describe("verifyRevenueCatWebhook", () => {
  const body = JSON.stringify({ event: { id: "e1", type: "RENEWAL" } });
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    delete process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("refuses everything when no secret is configured", () => {
    // An endpoint that grants entitlements must never be open.
    const r = verifyRevenueCatWebhook(body, { authorization: "anything", signature: null });
    expect(r.ok).toBe(false);
  });

  it("accepts a matching authorization header and rejects a wrong one", () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "s3cret-value";
    expect(verifyRevenueCatWebhook(body, { authorization: "s3cret-value", signature: null }).ok).toBe(true);
    expect(verifyRevenueCatWebhook(body, { authorization: "wrong", signature: null }).ok).toBe(false);
    expect(verifyRevenueCatWebhook(body, { authorization: null, signature: null }).ok).toBe(false);
  });

  it("verifies the HMAC signature over the raw body", () => {
    process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = "signing-key";
    const mac = createHmac("sha256", "signing-key").update(body, "utf8").digest("hex");
    expect(verifyRevenueCatWebhook(body, { authorization: null, signature: `t=1,v1=${mac}` }).ok).toBe(true);
    expect(verifyRevenueCatWebhook(body, { authorization: null, signature: "t=1,v1=deadbeef" }).ok).toBe(false);
    expect(verifyRevenueCatWebhook(body, { authorization: null, signature: null }).ok).toBe(false);
  });

  it("rejects a tampered body even with a once-valid signature", () => {
    process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = "signing-key";
    const mac = createHmac("sha256", "signing-key").update(body, "utf8").digest("hex");
    const tampered = JSON.stringify({ event: { id: "e1", type: "INITIAL_PURCHASE" } });
    expect(verifyRevenueCatWebhook(tampered, { authorization: null, signature: `t=1,v1=${mac}` }).ok).toBe(false);
  });

  it("requires both when both are configured", () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "s3cret-value";
    process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = "signing-key";
    const mac = createHmac("sha256", "signing-key").update(body, "utf8").digest("hex");
    expect(verifyRevenueCatWebhook(body, { authorization: "s3cret-value", signature: `t=1,v1=${mac}` }).ok).toBe(true);
    expect(verifyRevenueCatWebhook(body, { authorization: "s3cret-value", signature: "t=1,v1=bad" }).ok).toBe(false);
    expect(verifyRevenueCatWebhook(body, { authorization: "nope", signature: `t=1,v1=${mac}` }).ok).toBe(false);
  });

  it("tolerates a Bearer prefix, stray spaces and copied quotes", () => {
    // The secret has to be typed into two different boxes by a person, and
    // these are the ways the same value arrives looking different. None of
    // them is a different secret, so none should reject the webhook.
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "s3cret-value";
    for (const sent of [
      "Bearer s3cret-value",
      "bearer   s3cret-value",
      "  s3cret-value  ",
      '"s3cret-value"',
      "'s3cret-value'",
    ]) {
      expect(verifyRevenueCatWebhook(body, { authorization: sent, signature: null }).ok).toBe(true);
    }
  });

  it("matches when the configured value carries the quotes from a .env line", () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = '"s3cret-value"';
    expect(verifyRevenueCatWebhook(body, { authorization: "s3cret-value", signature: null }).ok).toBe(true);
  });

  it("still rejects a genuinely different secret, and says so without leaking it", () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "s3cret-value";
    const r = verifyRevenueCatWebhook(body, { authorization: "Bearer other-value", signature: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // The reason is what the caller sees; the detail is for our log only.
    expect(r.reason).toBe("bad authorization header");
    expect(r.detail).toMatch(/got len=11 fp=[0-9a-f]{12}, want len=12 fp=[0-9a-f]{12}/);
    expect(r.detail).not.toContain("s3cret-value");
  });

  it("reports a missing header as such rather than as a mismatch", () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = "s3cret-value";
    const r = verifyRevenueCatWebhook(body, { authorization: null, signature: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toContain("got len=0 fp=none");
  });
});

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe("grantPromotionalEntitlement", () => {
  const saved = { ...process.env };
  let calls: Array<{ url: string; method: string }>;

  beforeEach(() => {
    process.env.REVENUECAT_SECRET_API_KEY = "sk_test";
    calls = [];
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  function stubFetch(responses: Response[]) {
    let i = 0;
    vi.stubGlobal("fetch", async (url: string | URL, init?: { method?: string }) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return responses[Math.min(i++, responses.length - 1)];
    });
  }

  it("creates the subscriber and retries when RevenueCat answers 7259", async () => {
    // An artist who signed up on the web and redeemed a 100%-off code has
    // never opened the app, so RevenueCat holds no record of them until one is
    // read back. This is the case that was failing in production.
    stubFetch([
      jsonResponse(404, { code: 7259, message: "The subscriber was not found." }),
      jsonResponse(200, { subscriber: { entitlements: {} } }),
      jsonResponse(200, { subscriber: { entitlements: { pro: { expires_date: null } } } }),
    ]);

    const r = await grantPromotionalEntitlement("user_1", "pro", null);

    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[1].method).toBe("GET");
    expect(calls[1].url).toContain("/v1/subscribers/user_1");
    expect(calls[2].url).toContain("/promotional");
  });

  it("does not retry an error that is not a missing subscriber", async () => {
    stubFetch([jsonResponse(500, { code: 7000, message: "server error" })]);
    const r = await grantPromotionalEntitlement("user_1", "pro", null);
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("grants in a single call when the subscriber already exists", async () => {
    stubFetch([jsonResponse(200, { subscriber: { entitlements: { pro: { expires_date: null } } } })]);
    const r = await grantPromotionalEntitlement("user_1", "pro", null);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("waits out RevenueCat's per-subscriber lock and retries once", async () => {
    // Two entitlements for the same artist used to be granted in parallel and
    // collide; callers are sequential now, but a webhook can still land while a
    // restore is running.
    stubFetch([
      jsonResponse(409, { code: 7694, message: "There is another request in flight that is conflicting with this one." }),
      jsonResponse(200, { subscriber: { entitlements: { premium: { expires_date: null } } } }),
    ]);

    const r = await grantPromotionalEntitlement("user_1", "premium", null);

    expect(r.ok).toBe(true);
    // Straight to a second grant — no subscriber read, the subscriber exists.
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.url.includes("/promotional"))).toBe(true);
  });

  it("gives up rather than looping when the subscriber cannot be created", async () => {
    stubFetch([jsonResponse(404, { code: 7259, message: "The subscriber was not found." })]);
    const r = await grantPromotionalEntitlement("user_1", "pro", null);
    expect(r.ok).toBe(false);
    // Grant, failed create, and no second grant.
    expect(calls).toHaveLength(2);
  });
});

describe("planFromSubscription — code-activated plans", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const past = new Date("2026-11-01T12:00:00Z");
  const soon = new Date("2026-12-15T12:00:00Z");

  it("grants the plan while a promo period is still running", () => {
    expect(planFromSubscription({ plan: "pro", status: "active", provider: "promo", currentPeriodEnd: soon }, now)).toBe("pro");
  });

  it("ends access when the promo period has passed — nothing else will", () => {
    // No store sends a webhook for a 100%-off activation, so the end date on
    // the row is the only thing that can retire it.
    expect(planFromSubscription({ plan: "pro", status: "active", provider: "promo", currentPeriodEnd: past }, now)).toBe("free");
  });

  it("never expires a promo granted with no end date", () => {
    expect(planFromSubscription({ plan: "premium", status: "active", provider: "promo", currentPeriodEnd: null }, now)).toBe("premium");
  });

  it("leaves Stripe subscriptions alone — their status is authoritative", () => {
    // Stripe keeps `active` across a renewal before it moves the period end.
    expect(planFromSubscription({ plan: "pro", status: "active", provider: "stripe", currentPeriodEnd: past }, now)).toBe("pro");
  });
});
