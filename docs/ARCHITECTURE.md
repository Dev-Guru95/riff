# Riff — Codebase Architecture

> **Who this is for:** a developer joining the project who needs to know *where things live and why*, not what the product does.
>
> For **what the product is and what's built**, read [`../README.md`](../README.md) and [`PLATFORM.md`](./PLATFORM.md).
> For **how to use the features**, read [`FEATURE_GUIDE.md`](./FEATURE_GUIDE.md).

---

## 1. Repo shape — it is *not* a monorepo

One repo, one package, one deployable app.

| | |
|---|---|
| **GitHub** | `github.com/Dev-Guru95/riff-app` — single remote, single branch (`main`) |
| **Monorepo?** | **No.** One `package.json`. No `pnpm-workspace.yaml`, no `turbo.json`, no `apps/` or `packages/` |
| **Package manager** | pnpm (`pnpm-lock.yaml` is committed — use pnpm, not npm) |
| **Deploy target** | Vercel |

### Three names for the same thing

Don't let this trip you up:

- **`course-web`** — the local folder name and the `name` field in `package.json` (a leftover from the initial scaffold)
- **`riff-app`** — the GitHub repository name
- **Riff** — the product name

All three refer to this one codebase.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.9**, App Router |
| UI | **React 19.2**, TypeScript (strict), **Tailwind CSS v4** |
| Data | **Prisma 6** — SQLite in dev, Postgres intended for prod (see §5) |
| Auth | Hand-rolled — bcrypt + JWT in an httpOnly cookie (`riff_session`), TOTP MFA via `otplib` |
| Validation | **Zod v4** on every API input |
| Payments | **Stripe** (checkout, customer portal, signed webhooks) |
| AI | **DeepSeek** when `DEEPSEEK_API_KEY` is set, deterministic mock otherwise |
| Tests | **Vitest** |
| Client data | TanStack Query |

> ⚠️ **Read `AGENTS.md` before writing code.** This Next.js version has breaking changes versus what's widely documented online. The authoritative docs ship with the package at `node_modules/next/dist/docs/`. Don't trust blog posts or memory for App Router APIs here.

---

## 3. There is no separate backend

The single most important thing to understand: **frontend and backend are the same app.** There is no API service, no separate server repo, no BFF.

- The "backend" is **99 route handlers** at `src/app/api/**/route.ts`
- They run as Vercel Functions in the same deployment as the UI
- They talk to Postgres/SQLite directly via Prisma
- The browser calls them with plain `fetch` on same-origin paths

So a feature change is usually: `prisma/schema.prisma` → `src/lib/<feature>.ts` → `src/app/api/<feature>/route.ts` → the page under `src/app/(app)/<feature>/`.

---

## 4. Directory layout

```
.
├── src/
│   ├── app/                    # routes — UI and API in the same tree
│   │   ├── layout.tsx          # root layout
│   │   ├── (auth)/             # login, signup
│   │   ├── (app)/              # the product (shared authed layout + nav)
│   │   ├── (admin)/            # admin console (own layout, role-gated)
│   │   ├── u/[handle]/         # public artist profile (no auth)
│   │   └── api/                # 99 route.ts handlers = the entire backend
│   ├── lib/                    # business logic — ~50 modules. THE IMPORTANT DIRECTORY
│   ├── components/             # shared React components (only 9 — see §6)
│   └── types/                  # ambient .d.ts shims
├── prisma/
│   ├── schema.prisma           # 66 models — the source of truth for all data
│   ├── migrations/             # committed, ordered, never edit an applied one
│   ├── seed.ts                 # demo data
│   └── dev.db                  # local SQLite file
├── public/                     # static assets + badges/, certificate/, uploads/
├── docs/                       # this file, PLATFORM.md, FEATURE_GUIDE.md, handover docs
├── .github/workflows/ci.yml    # CI
├── vercel.json                 # cron jobs
└── AGENTS.md / CLAUDE.md       # AI-agent instructions (read AGENTS.md yourself too)
```

### Route groups — the parenthesised folders

`(auth)`, `(app)`, `(admin)` are **Next.js route groups**. The parentheses mean the folder name is **invisible in the URL** — it exists only to give a set of routes a shared `layout.tsx`.

So `src/app/(app)/dashboard/page.tsx` serves **`/dashboard`**, not `/(app)/dashboard`.

There are exactly three layouts: the root one, `(app)/layout.tsx` (authed shell + nav), and `(admin)/admin/layout.tsx` (admin shell + role check).

---

## 5. Data layer

`prisma/schema.prisma` holds **66 models** covering identity, courses, gamification, community, coaching, billing, boards, and Studio.

### The SQLite/Postgres portability rule — read this before touching the schema

Dev runs on **SQLite** so the app works with zero setup — `prisma/dev.db` is gitignored and generated locally by `pnpm db:migrate` + `pnpm db:seed`. Production is intended to be **Postgres** — you switch `provider` in the datasource block and re-run migrations.

To keep the schema valid on both engines, the schema deliberately avoids Postgres-only features:

- **Statuses are plain strings**, not native enums — the allowed values live in `src/lib/constants.ts`
- **Structured/list fields are JSON**, not Postgres arrays

> **Do not add a Prisma `enum` or a scalar list (`String[]`) to this schema.** It will work locally-ish but breaks the portability contract. Follow the existing string+constant / JSON pattern.

### Migrations

Committed and ordered under `prisma/migrations/`. Create with `pnpm db:migrate`. Never hand-edit a migration that's already been applied.

---

## 6. Where the logic lives

**`src/lib/` is where you should look first.** Routes and pages are thin; `lib` holds the real behaviour. A rough map:

| Area | Modules |
|---|---|
| Platform | `prisma.ts`, `api.ts`, `auth.ts`, `mfa.ts`, `crypto.ts`, `ratelimit.ts`, `constants.ts`, `admin.ts` |
| Learning | `enrollment.ts`, `progression.ts`, `markdown.ts`, `import/` |
| Gamification | `gamification.ts`, `achievements.ts`, `leaderboard.ts`, `missions.ts`, `milestones.ts`, `rewards.ts`, `certificates.ts` |
| AI | `ai-coach.ts`, `ai-review.ts`, `deepseek.ts`, `caption.ts` |
| Social / audit | `social.ts`, `social-providers.ts`, `audit.ts` |
| Community | `community.ts`, `share.ts`, `notifications.ts`, `events.ts` |
| Commerce | `stripe.ts`, `entitlements.ts`, `money.ts` |
| Boards | `boards.ts`, `board-templates.ts` |
| Studio | `studio.ts`, `studio-tools.ts`, `studio-growth.ts`, `goals.ts` |

`src/components/` is intentionally sparse (9 files). Most UI is written inline in page files against a small hand-rolled primitive set in `components/ui.tsx`. This is a known state, not an accident — see [`HANDOVER_FOR_DESIGNER.md`](./HANDOVER_FOR_DESIGNER.md).

---

## 7. API conventions

Every route handler follows the same shape, built on helpers in `src/lib/api.ts`:

```ts
export const POST = withRoute(async (req: Request) => {
  const { data, error } = await parseBody(req, MySchema);  // zod — 422 on failure
  if (error) return error;

  const user = await requireUser();                        // from lib/auth.ts
  ...
  return ok({ result });                                   // or fail("...", 400)
});
```

- **`withRoute`** wraps the handler so a thrown error is logged and returned as a sanitized 500 — stack traces never reach the client.
- **`ok` / `fail` / `tooMany`** are the only response constructors. Don't hand-roll `NextResponse.json` for errors.
- **`parseBody(req, schema)`** validates with Zod and returns a ready-made 422 on failure. Every mutating route validates its input.

Auth is a JWT in the httpOnly `riff_session` cookie (30-day expiry, bcrypt cost 12). `lib/auth.ts` refuses to start in production without a `JWT_SECRET` of 32+ characters rather than falling back to a guessable default.

---

## 8. Tests

Vitest, with test files **colocated next to the code** rather than in a separate tree — `src/lib/boards.ts` sits beside `src/lib/boards.test.ts`.

Coverage is targeted at the logic that's expensive to get wrong (achievements, boards, audit, money, crypto, MFA, rate limiting, markdown, studio, constants) rather than spread thin across the UI.

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

---

## 9. Running it locally

```bash
pnpm install
# create .env yourself — it's gitignored and there is no .env.example.
# Minimum to boot: DATABASE_URL="file:./dev.db" and a 32+ char JWT_SECRET. See §10.
pnpm exec prisma generate
pnpm db:migrate             # creates prisma/dev.db (gitignored)
pnpm db:seed
pnpm dev                    # http://localhost:3000
```

> Ask a teammate for a `.env` — it is not in the repo, by design.

Seeded logins: `demo@riff.app` / `password123` (artist), `admin@riff.app` / `admin12345` (admin).

Everything runs **fully offline**. Without `DEEPSEEK_API_KEY` the AI features fall back to deterministic mocks; without Stripe keys billing is inert. You do not need any third-party account to develop.

### Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create + apply a migration |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:reset` | **Destructive** — wipe and re-migrate |
| `pnpm db:studio` | Prisma Studio (visual DB browser) |

---

## 10. Environment

Keys read from `.env` (names only — values are secrets, never commit real ones):

**Required:** `DATABASE_URL`, `JWT_SECRET` (32+ chars), `APP_URL`, `APP_ENCRYPTION_KEY`

**Optional — features degrade gracefully without them:**
`DEEPSEEK_API_KEY`, `AI_MODEL` · `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` · `SOCIAL_{SPOTIFY,YOUTUBE,FACEBOOK,INSTAGRAM,TIKTOK,X}_CLIENT_{ID,SECRET}`

---

## 11. CI/CD

**CI** (`.github/workflows/ci.yml`) runs on every PR and every push to `main`:

```
pnpm install --frozen-lockfile
prisma generate → prisma migrate deploy
pnpm typecheck → pnpm test → pnpm build
```

All five steps must pass. CI runs against a throwaway SQLite file.

**Deploy:** Vercel, from `main`.

**Cron:** `vercel.json` registers one job — `/api/cron/due-soon` daily at 13:00 UTC (board card due-date notifications).

---

## 12. Things that will bite you

1. **Don't reach for Next.js knowledge from memory or blog posts.** This version has breaking changes. `node_modules/next/dist/docs/` is the source of truth. This is what `AGENTS.md` is warning about.
2. **Don't add Prisma enums or scalar lists** — breaks SQLite/Postgres portability. Strings + `lib/constants.ts`, or JSON. (§5)
3. **Route groups aren't URL segments.** `(app)/dashboard` → `/dashboard`. (§4)
4. **Put logic in `lib/`, not in the route or the page.** Routes parse, authorize, and delegate. It's also the only way it gets unit-tested.
5. **Uploads go to `public/uploads/`** on local disk (gitignored). That works in dev and breaks on serverless — it needs to become S3 or Vercel Blob before real production traffic.
6. **`.env` and `prisma/dev.db` are gitignored**, and there's no `.env.example`. A fresh clone won't run until you write a `.env` and migrate. Budget five minutes for it.
7. **pnpm only.** Using npm or yarn will desync `pnpm-lock.yaml` and fail CI's `--frozen-lockfile`.
