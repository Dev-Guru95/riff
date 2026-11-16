import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PlanKey } from "./stripe";
import { PLANS } from "./stripe";

/**
 * RevenueCat is the cross-platform entitlement mirror.
 *
 * Stripe charges the card and our own Subscription row is what gates features,
 * but every paid subscription is also pushed to RevenueCat so that the same
 * person signing in from another platform resolves to the same entitlements.
 *
 * Note on keys: POST /v1/receipts authenticates with the *public* SDK key of
 * the RevenueCat Stripe app (not a Stripe key, and not RevenueCat's secret
 * key). Reading a subscriber back needs the secret v1 key. Both are read here
 * and never leave the server.
 */
const API = process.env.REVENUECAT_API_URL || "https://api.revenuecat.com";

// Read lazily rather than at module load: the test suite and the local dev
// server both set these after import.
const PUBLIC_KEY = () => process.env.REVENUECAT_STRIPE_PUBLIC_API_KEY ?? "";
const SECRET_KEY = () => process.env.REVENUECAT_SECRET_API_KEY ?? "";
const WEBHOOK_AUTH = () => process.env.REVENUECAT_WEBHOOK_AUTHORIZATION ?? "";
const WEBHOOK_SIGNING_SECRET = () => process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET ?? "";

/** Can we push purchases to RevenueCat? */
export function isRevenueCatConfigured(): boolean {
  return !!PUBLIC_KEY();
}

/** Can we read entitlements back out of RevenueCat? */
export function canReadRevenueCat(): boolean {
  return !!SECRET_KEY();
}

/** Is the inbound RevenueCat webhook protected by a shared secret? */
export function isRevenueCatWebhookConfigured(): boolean {
  return !!WEBHOOK_AUTH() || !!WEBHOOK_SIGNING_SECRET();
}

export type RevenueCatResult =
  | { ok: true; entitlementIds: string[] }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; status: number; reason: string };

/** Compare two secrets without leaking their length or content through timing. */
function safeEqual(a: string, b: string): boolean {
  // Hashing first makes the compared buffers equal-length, so timingSafeEqual
  // cannot throw and the comparison does not reveal the expected length.
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Make an Authorization value comparable before it is matched.
 *
 * The expected value and the one RevenueCat sends are typed into two different
 * boxes by a person, so they drift in ways that are invisible on screen: a
 * space picked up by the paste, the quotes from a `.env` line copied verbatim,
 * or a `Bearer ` prefix added because every other Authorization header has one.
 * None of those change which secret is being presented, so both sides are
 * normalised and the secret itself still has to match exactly.
 */
function normalizeAuthValue(value: string): string {
  let v = value.trim();
  const quoted =
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")));
  if (quoted) v = v.slice(1, -1).trim();
  return v.replace(/^bearer\s+/i, "").trim();
}

/**
 * First 12 hex characters of the sha256 — enough to tell two secrets apart in a
 * log, far too little to recover either. Without it a wrong secret and a
 * missing header look identical, and the only way to debug a rejected webhook
 * is to paste real secrets around.
 */
function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

/**
 * Push a Stripe subscription to RevenueCat so it owns the entitlement too.
 *
 * `appUserId` is always our own user id — the mobile SDK logs in with the same
 * value, which is what makes the purchase follow the person across platforms.
 * `fetchToken` is the Stripe subscription id (`sub_...`).
 *
 * Re-posting the same subscription is safe, and is how a cancellation is pushed
 * through immediately rather than waiting for RevenueCat to notice it in Stripe
 * (which its docs say can take up to two hours).
 */
export async function pushStripeSubscription(
  appUserId: string,
  stripeSubscriptionId: string,
): Promise<RevenueCatResult> {
  if (!isRevenueCatConfigured()) {
    return { ok: false, skipped: true, reason: "RevenueCat is not configured" };
  }
  try {
    const res = await fetch(`${API}/v1/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Platform": "stripe",
        Authorization: `Bearer ${PUBLIC_KEY()}`,
      },
      body: JSON.stringify({ app_user_id: appUserId, fetch_token: stripeSubscriptionId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Status plus a short excerpt is enough to debug; never log the whole body.
      return { ok: false, status: res.status, reason: text.slice(0, 200) || res.statusText };
    }

    const body = (await res.json()) as { subscriber?: RevenueCatSubscriber };
    return { ok: true, entitlementIds: activeEntitlementIds(body.subscriber) };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : "network error" };
  }
}

export type RevenueCatSubscriber = {
  entitlements?: Record<string, { expires_date: string | null; product_identifier?: string }>;
  subscriptions?: Record<string, { expires_date: string | null; store?: string; unsubscribe_detected_at?: string | null }>;
  original_app_user_id?: string;
};

/** Entitlement ids that are currently unexpired for this subscriber. */
export function activeEntitlementIds(sub: RevenueCatSubscriber | undefined | null): string[] {
  if (!sub?.entitlements) return [];
  const now = Date.now();
  return Object.entries(sub.entitlements)
    .filter(([, e]) => e.expires_date === null || Date.parse(e.expires_date) > now)
    .map(([id]) => id);
}

/** Read a subscriber back from RevenueCat. Needs the secret v1 key. */
export async function getSubscriber(appUserId: string): Promise<RevenueCatSubscriber | null> {
  if (!canReadRevenueCat()) return null;
  try {
    const res = await fetch(`${API}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${SECRET_KEY()}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { subscriber?: RevenueCatSubscriber };
    return body.subscriber ?? null;
  } catch {
    return null;
  }
}

/**
 * Bring a subscriber into existence, reporting whether it is there afterwards.
 *
 * RevenueCat creates a subscriber lazily: the record appears the first time the
 * SDK logs in as that app_user_id, or the first time one is read back. An
 * artist who signs up on the web and redeems a 100%-off code has never opened
 * the app, so a promotional grant is the first RevenueCat hears of them and it
 * fails with 7259. A plain GET is the documented way to create the record from
 * the server, so reading the subscriber is what fixes it.
 */
async function ensureSubscriberExists(appUserId: string): Promise<boolean> {
  if (!canReadRevenueCat()) return false;
  try {
    const res = await fetch(`${API}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${SECRET_KEY()}`, "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verify an inbound RevenueCat webhook.
 *
 * RevenueCat authenticates webhooks with a shared Authorization header value
 * you set in its dashboard, and can additionally HMAC-sign the raw body. We
 * require whichever of the two is configured, and refuse everything when
 * neither is — an unauthenticated endpoint that can grant entitlements would be
 * a way for anyone to mint themselves a free subscription.
 */
export function verifyRevenueCatWebhook(
  rawBody: string,
  headers: { authorization: string | null; signature: string | null },
): { ok: true } | { ok: false; reason: string; detail?: string } {
  const expectedAuth = WEBHOOK_AUTH();
  const signingSecret = WEBHOOK_SIGNING_SECRET();

  if (!expectedAuth && !signingSecret) {
    return { ok: false, reason: "no RevenueCat webhook secret configured" };
  }

  if (expectedAuth) {
    const got = normalizeAuthValue(headers.authorization ?? "");
    const want = normalizeAuthValue(expectedAuth);
    if (!got || !safeEqual(got, want)) {
      return {
        ok: false,
        reason: "bad authorization header",
        // Logged by the caller, never returned in the response: an
        // unauthenticated prober must not learn the length or the fingerprint
        // of the secret it is guessing at.
        detail: `got len=${got.length} fp=${got ? fingerprint(got) : "none"}, want len=${want.length} fp=${fingerprint(want)}`,
      };
    }
  }

  if (signingSecret) {
    // Header shape: `t=<unix seconds>,v1=<hex hmac of the raw body>`
    const parts: Record<string, string> = {};
    for (const kv of (headers.signature ?? "").split(",")) {
      const i = kv.indexOf("=");
      if (i !== -1) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    }
    const provided = parts.v1;
    if (!provided) return { ok: false, reason: "missing signature" };
    const expected = createHmac("sha256", signingSecret).update(rawBody, "utf8").digest("hex");
    if (!safeEqual(provided, expected)) return { ok: false, reason: "bad signature" };
  }

  return { ok: true };
}

/**
 * Collapse RevenueCat entitlement ids down to one of our plans.
 * Highest entitlement wins, so a subscriber holding both resolves to premium.
 */
export function planForEntitlementIds(ids: readonly string[]): PlanKey {
  const set = new Set(ids);
  if (set.has("premium")) return "premium";
  if (set.has("pro")) return "pro";
  return "free";
}

/** The entitlement ids a plan should grant. Mirror of the RevenueCat config. */
export function entitlementsForPlan(plan: PlanKey): string[] {
  return PLANS[plan].entitlements;
}

/** Map a RevenueCat `store` to the `provider` we record on the subscription. */
export function providerForStore(store: string | undefined | null): string {
  switch ((store ?? "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "app_store";
    case "PLAY_STORE":
      return "play_store";
    case "STRIPE":
      return "stripe";
    case "PROMOTIONAL":
      return "promo";
    default:
      return "stripe";
  }
}

/** True when Stripe, not RevenueCat, is the authority for this store's events. */
export function stripeIsAuthoritative(store: string | undefined | null): boolean {
  return (store ?? "").toUpperCase() === "STRIPE";
}

/**
 * Grant a promotional entitlement — the RevenueCat side of a 100%-off code.
 *
 * A free activation has no receipt to post: no card was charged, so there is no
 * Stripe subscription id to send to /v1/receipts. RevenueCat's promotional
 * endpoint exists for exactly this, and it is what makes `provider: "promo"`
 * resolve to the same entitlements on every other platform the artist signs in
 * from. Unlike pushStripeSubscription this needs the *secret* v1 key.
 *
 * `endsAt` of null grants it with no end date.
 */
export async function grantPromotionalEntitlement(
  appUserId: string,
  entitlementId: string,
  endsAt: Date | null,
): Promise<RevenueCatResult> {
  if (!canReadRevenueCat()) {
    return { ok: false, skipped: true, reason: "RevenueCat secret key is not configured" };
  }

  const first = await postPromotionalGrant(appUserId, entitlementId, endsAt);
  if (first.ok) return first;

  if (isSubscriberNotFound(first)) {
    // The artist exists for us but not yet for RevenueCat, which is the usual
    // case for a web signup redeeming a code: create the record, then grant
    // once more. One retry only — if the subscriber still is not there, the
    // cause is something other than the lazy creation this handles.
    if (!(await ensureSubscriberExists(appUserId))) return first;
    return postPromotionalGrant(appUserId, entitlementId, endsAt);
  }

  if (isConflict(first)) {
    // RevenueCat locks per subscriber, so a grant that overlaps another one for
    // the same person is refused rather than queued. Callers grant one at a
    // time; this covers two of them arriving at once, such as a webhook landing
    // while a restore is running.
    await delay(CONFLICT_RETRY_MS);
    return postPromotionalGrant(appUserId, entitlementId, endsAt);
  }

  return first;
}

/** How long to wait out RevenueCat's per-subscriber lock before retrying. */
const CONFLICT_RETRY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** RevenueCat's "the subscriber was not found": error code 7259, HTTP 404. */
function isSubscriberNotFound(result: RevenueCatResult): boolean {
  if (result.ok || result.skipped) return false;
  return result.status === 404 || result.reason.includes("7259");
}

/** RevenueCat's "another request in flight for this subscriber": 7694. */
function isConflict(result: RevenueCatResult): boolean {
  if (result.ok || result.skipped) return false;
  return result.status === 409 || result.reason.includes("7694");
}

/** The grant request itself, split out so it can be retried unchanged. */
async function postPromotionalGrant(
  appUserId: string,
  entitlementId: string,
  endsAt: Date | null,
): Promise<RevenueCatResult> {
  try {
    const res = await fetch(
      `${API}/v1/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entitlementId)}/promotional`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET_KEY()}`, "Content-Type": "application/json" },
        body: JSON.stringify(endsAt ? { end_time_ms: endsAt.getTime() } : { duration: "lifetime" }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, reason: text.slice(0, 200) || res.statusText };
    }
    const body = (await res.json()) as { subscriber?: RevenueCatSubscriber };
    return { ok: true, entitlementIds: activeEntitlementIds(body.subscriber) };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : "network error" };
  }
}
