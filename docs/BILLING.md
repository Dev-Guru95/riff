# Billing — Stripe + RevenueCat

## How it works

**Stripe is the only thing that charges a card.** Checkout happens on the web
only; the native app sells nothing by design (App Store 3.1.1 / Play Payments —
see `docs/STORE_READINESS.md`), and `/api/billing/checkout` refuses native
clients outright.

**RevenueCat is an entitlement mirror, not a second checkout.** Every Stripe
subscription is pushed to `POST https://api.revenuecat.com/v1/receipts` with
`X-Platform: stripe` and `app_user_id` set to our own user id, so the same
person signing in from another platform resolves to the same entitlements.

**Our own `Subscription` row is what every feature gate reads.** It is written
only by `src/lib/subscriptions.ts`, which every path funnels through.

### Who is authoritative

| Purchase origin | Authority | Why |
| --- | --- | --- |
| Stripe | Stripe | RevenueCat can take **up to two hours** to surface a Stripe cancellation. The RevenueCat webhook therefore re-reads Stripe instead of trusting its own payload — otherwise stale state would overwrite fresh state. |
| App Store / Play | RevenueCat | There is no Stripe record to read. |

This asymmetry is deliberate. Verified in practice: immediately after a Stripe
cancellation RevenueCat still reported `[premium, pro]` while our gate already
returned `free`.

## Key policy

**Local `.env` holds test keys only.** It drives `npm run dev`, so a live secret
key there would mean local development creates real charges. Live keys live only
in the production environment.

| Variable | Local | Production |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | test endpoint's `whsec_…` | **live endpoint's own** `whsec_…` |
| `STRIPE_PRICE_PRO` / `_PREMIUM` | test price ids | live price ids |
| `REVENUECAT_STRIPE_PUBLIC_API_KEY` | `strp_sb_…` (sandbox) | `strp_…` (live config) |
| `REVENUECAT_SECRET_API_KEY` | `sk_…` | same or a separate key |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | shared secret | same value set in RevenueCat |
| `APP_URL` | `http://localhost:3000` | `https://riffartists.com` |

Every webhook endpoint has its **own** signing secret. Using the test secret
against the live endpoint makes every delivery fail verification with a 400.

## Going live

Steps marked **(you)** cannot be automated — they need account-owner
verification or grant third-party access to real money.

1. **(you)** Confirm the Stripe account is activated — `charges_enabled` and
   `payouts_enabled` must be true. (Already true for `acct_1UZrazAJE2OwYQbs`.)

2. **(you)** Create a **restricted** live key with write access to *Products*,
   *Prices* and *Webhook Endpoints* only. Stripe emails a verification link
   before it will issue a live key. Do not use a full secret key here.

3. Create the live products, prices and webhook:

   ```bash
   STRIPE_LIVE_SETUP_KEY=rk_live_... npx tsx scripts/setup-stripe-live.ts
   ```

   Idempotent — it looks products up by lookup key and the webhook up by URL.
   It prints the production env block, including the webhook signing secret
   (shown **only** at creation time).

4. **(you)** Revoke the restricted setup key — it has done its job.

5. Create the key the server will use, with the **"Full access – except
   sensitive operations"** template. Stripe issues this as a *restricted* key
   (`rk_live_…`, not `sk_live_…`) — it can run Checkout, customers,
   subscriptions, the portal and refunds, but cannot move money out of the
   account to a bank or card. `STRIPE_SECRET_KEY` accepts it unchanged.

   Creating any live key needs an emailed verification link **and** a 6-digit
   authenticator code, and the value is shown exactly once.

6. Activate the **Customer portal** in live mode: Settings → Billing →
   Customer portal → Save. Without a saved configuration, `/api/billing/portal`
   fails in live mode with "No configuration provided" and the *Manage
   subscription* button breaks for real customers.

   Leave *"Let customers switch plans"* **off**: `/pricing` already changes the
   plan in place via `/api/billing/checkout`, and enabling it here would add a
   second, separately-configured path to the same thing. Cancellation should
   stay on and set to *at the end of the billing period*, which is what the
   pricing page promises.

7. **(you)** Install the RevenueCat app into **live** Stripe from
   <https://marketplace.stripe.com/apps/revenuecat> ("Install app" → Live mode),
   then sign in with RevenueCat from the app's settings page. This grants
   RevenueCat read/write over real Customers, Subscriptions, Prices, Products,
   Payment Intents and Payment Methods.

8. In RevenueCat → **Web** → new Stripe configuration pointing at the live
   account. Then Product catalog → **Import** the two live products, and attach
   them to the entitlements: `pro` gets **both** products (Premium includes
   Pro), `premium` gets Premium only.

   > **A separate configuration per mode is required.** Importing live products
   > into the configuration that was created for test mode fails with
   > "N products failed" and no explanation. Create a second configuration for
   > live and import into that one. The live config then lists *all* four
   > products (test and live) on its import screen — select only the live price
   > ids, or test products will be mixed into live entitlements.

   > Entitlement ids must stay exactly `pro` and `premium` — they are mirrored
   > in `PLANS[*].entitlements` in `src/lib/stripe.ts`.

9. Copy the live config's public API key into `REVENUECAT_STRIPE_PUBLIC_API_KEY`
   in production. The existing RevenueCat webhook already covers both
   environments ("Both Production and Sandbox").

10. Apply the migration and deploy:

    ```bash
    npm run db:deploy      # applies 20261112093000_stripe_revenuecat_billing
    ```

    Then build and restart the app (see `docs/PLATFORM.md` for the VPS
    build + pm2 swap procedure).

## Live configuration (as built)

Created 2026-11-12 in `acct_1UZrazAJE2OwYQbs`. These identifiers are not
secret; the matching secrets live only in the production environment.

| Thing | Live value |
| --- | --- |
| Pro product / price | `prod_VcCvwSF266MMGr` / `price_1UayVuAJE2OwYQbsnRQiQ8hN` ($19/mo) |
| Premium product / price | `prod_VcCvX8gsnM6tQ2` / `price_1UayVwAJE2OwYQbsuE7EN7OL` ($39/mo) |
| Stripe webhook | `we_1UayVxAJE2OwYQbsdw4JXwlZ` → `/api/webhooks/stripe`, 9 events |
| RevenueCat live config | `app33ca8dfaa4` ("Riff (Stripe live)") |
| RevenueCat test config | `appd6c27d3457` ("Riff (Stripe sandbox)") |
| Live customer portal | `bpc_1UayvMAJE2OwYQbsUbsBXFfl` (default, cancel at period end) |
| Entitlements | `pro` → 4 products (2 test + 2 live); `premium` → 2 (1 test + 1 live) |

The RevenueCat webhook covers **both** environments, so there is only one of
those and one shared `REVENUECAT_WEBHOOK_AUTHORIZATION`.

## Verifying

```bash
# Stripe lifecycle against real sandbox objects; creates and deletes its own data
npx tsx --env-file=.env scripts/verify-billing.ts

# Stripe -> RevenueCat entitlement mirror
npx tsx --env-file=.env scripts/verify-revenuecat.ts
```

A live endpoint that is reachable and configured answers an unsigned POST with
**400 Missing signature**. `503` means the Stripe env vars are missing; `404`
means this code is not deployed yet.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://riff.soundrig.io/api/webhooks/stripe
```

## Gotchas

- **Never trust the post-checkout redirect.** `/settings/billing?status=success`
  only reads what the verified webhook wrote; if they disagree it says the
  payment is still being confirmed rather than showing a plan the user does not
  have.
- **Upgrades edit the live subscription in place.** Sending an existing
  subscriber back through Checkout would open a second subscription and bill
  them twice.
- **Webhooks are idempotent** via the `WebhookEvent` ledger: the event id is
  claimed before the work and released if the handler throws, so provider
  retries genuinely reprocess rather than being swallowed.
- **The RevenueCat webhook refuses every request** when neither
  `REVENUECAT_WEBHOOK_AUTHORIZATION` nor `REVENUECAT_WEBHOOK_SIGNING_SECRET` is
  set. An open endpoint that grants entitlements would let anyone mint a
  subscription.
