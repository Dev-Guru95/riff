# Staging

A second, private copy of Riff on the same VPS as production, so work can
happen somewhere that customers cannot reach.

Production and "live" are the same thing. This document is about the *other*
environment: **staging**, where you work.

| | Production | Staging |
| --- | --- | --- |
| URL | https://riffartists.com | none — SSH tunnel to `localhost:4004` |
| pm2 process | `riff` | `riff-staging` |
| Port | 4003 | 4004 |
| Directory | `~/apps/riff` | `~/apps/riff-staging` |
| Postgres schema | `riff` | `riff_staging` |
| Stripe | **live** keys (`rk_live_…`) | **test** keys (`sk_test_…`) |
| RevenueCat | configured | deliberately unset |
| Email (SMTP) | configured | deliberately unset |
| Uploads | `/home/riff/uploads` | `/home/riff/uploads-staging` |
| `JWT_SECRET` / `APP_ENCRYPTION_KEY` | production values | different values |
| Logs | `~/apps/logs/{out,err}.log` | `~/apps/logs/staging-{out,err}.log` |

## Opening staging

Staging has no public URL on purpose — nothing to index, nothing for a customer
to stumble onto, no certificate to maintain. Reach it through an SSH tunnel:

```bash
ssh -L 4004:localhost:4004 riff-prod
```

Leave that running, then open <http://localhost:4004>.

Sign in with the seeded accounts:

- `demo@riff.app` / `password123`
- `admin@riff.app` / `admin12345` (admin screens)

Those accounts exist **only** in staging. Production has neither.

## Deploying to staging

```bash
./scripts/deploy-staging.sh            # deploys HEAD
./scripts/deploy-staging.sh my-branch  # deploys a branch or tag
./scripts/deploy-staging.sh --dirty    # includes uncommitted work
```

The script keeps the staging `.env` and pm2 config, replaces the code, installs,
runs `prisma migrate deploy` against the staging schema, rebuilds and restarts.
Before it builds it re-checks that the env still points at `riff_staging` and
still holds a Stripe **test** key, and aborts if either stops being true — the
failure that would matter most here is staging quietly acquiring production
credentials.

## What is shared, and what that means

The two environments share exactly two things: the **VPS** and the **Postgres
server**. Everything else is separate.

Sharing the Postgres *server* (not the database — the `riff` role has no
CREATEDB right, so staging lives in its own schema inside the same database) is
the one compromise. In practice Prisma scopes every statement to the schema in
`DATABASE_URL`, so migrations, seeds and resets in staging cannot reach
production tables. What it does not protect against is someone running raw SQL
without a schema qualifier. Treat `psql` against this box with the same care you
would in production.

Sharing the VPS means staging competes for RAM. The box has ~3.8 GB and both
apps idle around 230 MB, so there is room — but staging's pm2 config caps it at
`max_memory_restart: 400M` so it restarts rather than pushing the live site into
swap.

## Limits worth knowing before you test

- **Stripe webhooks do not reach staging.** It has no public URL, so a checkout
  started in staging will not sync back and the plan will not switch on. To test
  the full billing round trip, run the Stripe CLI alongside the tunnel:
  ```bash
  stripe listen --forward-to localhost:4004/api/webhooks/stripe
  ```
  and put the `whsec_…` it prints into `~/apps/riff-staging/.env`.
- **No outbound email.** SMTP is unset, so password-reset and broadcast emails
  are not sent. This is deliberate: staging must never mail a real person.
- **RevenueCat is unset**, so staging cannot grant or revoke an entitlement on
  the live RevenueCat project. Billing degrades gracefully without it.
- **Social OAuth sign-in will not complete.** The provider apps' redirect URIs
  point at the production domain, not `localhost:4004`.
- **The AI key is shared with local development**, so generations from staging
  bill to the same DeepSeek account. Unset `DEEPSEEK_API_KEY` in the staging
  `.env` to fall back to the deterministic mocks, which cost nothing and make
  staging reproducible.

## Resetting staging data

Staging data is disposable. To wipe it and start clean:

```bash
ssh riff-prod 'cd ~/apps/riff-staging && npx prisma migrate reset --force \
  && SEED_DEMO_USERS=true pnpm run db:seed && pnpm run db:import-tracks'
```

`migrate reset` is scoped to the schema in `DATABASE_URL`, which for staging is
`riff_staging`. Check that before you run it — this is the one command in this
document that would be genuinely destructive if the env were ever wrong.

## Stripe test prices

Staging uses test-mode prices that mirror the live ones, created by:

```bash
npx tsx --env-file=.env scripts/setup-stripe-test.ts
```

It refuses to run with anything other than a test key, the same way
`setup-stripe-live.ts` refuses anything other than a restricted live key.
Both read their amounts from `src/lib/pricing.ts`, so test and live cannot
drift apart.
