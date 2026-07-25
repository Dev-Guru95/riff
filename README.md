# Riff — AI Music Artist Education Platform

Gamified, AI-powered education that teaches independent artists the *business* of
music: marketing, branding, fan growth, streaming, release strategy, and more.

> Full product & architecture spec: [`docs/PLATFORM.md`](./docs/PLATFORM.md)

## What's built (Phase 0–1 vertical slice)

A fully working, end-to-end learning loop:

- **Auth** — email/password signup & login, JWT httpOnly session cookie, auto-enroll.
- **Structured courses** — Course → Module → Lesson → Quiz → Assignment with
  **gated progression** (a lesson unlocks only when the previous one is completed).
- **Gamification** — server-authoritative, append-only **XP ledger** (idempotent —
  no double-paying), 9 progression levels (Beginner Artist → Music Entrepreneur),
  **streaks** with freeze tokens, criteria-driven **badges**, progress rings/bars.
- **Badges & certificate** — journey badges + one **track-completion badge per
  course** (auto-generated) + a single **program certificate** awarded only after
  every track is done. Idempotent awarding, placeholder art that swaps with no code
  changes. See [`docs/ACHIEVEMENTS.md`](./docs/ACHIEVEMENTS.md).
- **AI assignment review** — submit text/links, get a 0–100 score with strengths,
  weaknesses, recommendations, and next actions. Uses DeepSeek if `DEEPSEEK_API_KEY`
  is set; otherwise a deterministic **mock reviewer** so it runs fully offline.
  Low-confidence reviews are flagged for human review.
- **Leaderboard** — weighted composite (XP, quiz, assignment, speed, consistency)
  with global / country / genre scopes.
- **Dashboard** — level, XP, streak, ranks, badges, and a single "next best action".
- **AI Artist Coach** — a personalized chat mentor that builds context from the artist's
  profile, goals, genre, progress, and latest audit scores (RAG-style memory). DeepSeek
  when keyed; deterministic context-aware mock otherwise.
- **AI Career Roadmap** — generates personalized 30-day / 90-day / 6-month / 12-month
  growth plans from the artist's data, with milestones and concrete tasks.
- **Social Media Audit** — connect platforms (IG/TikTok/YouTube/FB/X/Spotify) and get four
  formula-driven scores (Marketing, Branding, Growth, Consistency) with **month-over-month
  deltas** and AI recommendations. Audits feed insights back into the Coach.
- **Weekly Missions** — real-world challenges (branding/content/engagement/release) that
  award XP + streak on completion (idempotent).
- **Community** — forums, threads, peer feedback replies, win showcases, and
  accountability groups (join/leave).
- **File uploads** — assignments accept image/audio/video/PDF with size + MIME +
  magic-byte validation, stored under `/public/uploads` (swap for S3 in prod).
- **Community moderation** — report threads/posts/users, admin moderation queue with
  content removal, user blocking (blocked content hidden), and spam rate-limits.
- **Weekly missions** — auto-generated rotating weekly set; completion awards XP + badge
  + notification.
- **Notifications** — in-app bell (level-ups, badges, missions, rewards) with unread count.
- **Milestones** — derived career milestones with progress bars on the dashboard;
  level-up / badge-unlock celebration toasts in the lesson player.
- **Coach feedback** — 👍/👎 on coach replies (quality signal).
- **Rewards & redemption** — admin "issue Top-1000 rewards" (snapshots the board, notifies
  winners) + user coupon redemption with limits.
- **Analytics** — event tracking on key actions + a KPI panel on the admin overview.
- **Security hardening** — rate limiting (auth + AI), centralized error handling, CSP +
  security headers, prompt-injection guards, transactional XP, reward rollback on deletion.
- **TOTP MFA** — admins can enable two-factor (authenticator app) from `/admin/security`;
  login then requires a 6-digit code. Standard 30s TOTP (Google Authenticator / Authy / 1Password).
- **Streaming coach** — coach replies stream token-by-token over SSE.
- **Pagination** — leaderboard, forums, and admin user lists are paged (no silent caps).
- **Billing (Stripe)** — plans (Free/Pro/Premium), checkout + customer portal + signature-
  verified webhooks, per-plan entitlements (e.g. coach quota). Fully wired; shows a
  "not configured" state until Stripe keys are set. See *Going live* below.
- **Social OAuth** — real OAuth2 authorization-code flow for Spotify/YouTube/Facebook/
  Instagram/TikTok/X with CSRF state + AES-256-GCM encrypted token storage + refresh.
  Falls back to manual connect until provider keys are set.
- **Tests + CI** — Vitest unit suite + GitHub Actions (`typecheck` → `test` → `build`).
- **Admin dashboard** — role-gated (`admin`/`reviewer`/`moderator`) section with:
  overview analytics + engagement funnel; **course/module/lesson authoring** (incl. a
  quiz & assignment builder) with publish/draft toggle; an **assignment review queue**
  to confirm/override flagged AI scores; **user management** (role & suspend, with a
  self-suspend guard); **coupons & rewards**; and an **AI content-suggestion approval**
  queue. Every privileged action is written to an append-only **audit log**.

## Quick start

```bash
pnpm install
pnpm db:migrate      # create the SQLite dev database
pnpm db:seed         # sample course + badges + missions + demo user
pnpm dev             # http://localhost:3000
```

**Artist login:** `demo@riff.app` / `password123`
**Admin login:** `admin@riff.app` / `admin12345` → then open `/admin`

### Optional: enable the real AI reviewer
Add to `.env`:
```
DEEPSEEK_API_KEY=sk-...
AI_MODEL=deepseek-chat
```
Without it, the mock reviewer is used automatically.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:reset` | Drop, re-migrate, re-seed |
| `pnpm db:studio` | Open Prisma Studio (DB GUI) |

## Tech stack

- **Next.js 16** (App Router, RSC) · React 19 · TypeScript · Tailwind 4
- **Prisma** ORM — SQLite for local dev
- **bcryptjs** + **jsonwebtoken** auth · **zod** validation
- AI: DeepSeek chat-completions API (with offline mock fallback)

## Going live: billing & social OAuth

Both are fully coded and degrade gracefully until you add keys.

**Stripe** — set in `.env`:
```
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_...
STRIPE_PRICE_PRO=price_...           # recurring price IDs from your Stripe dashboard
STRIPE_PRICE_PREMIUM=price_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen` or the dashboard
APP_URL=https://your-domain.com
```
Point a Stripe webhook at `POST /api/webhooks/stripe` (events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`). Locally:
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

**Social OAuth** — per platform, register an app and set:
```
SOCIAL_SPOTIFY_CLIENT_ID=...   SOCIAL_SPOTIFY_CLIENT_SECRET=...
SOCIAL_YOUTUBE_CLIENT_ID=...   SOCIAL_YOUTUBE_CLIENT_SECRET=...
# ...facebook, instagram, tiktok, x
APP_ENCRYPTION_KEY=<32+ char secret>   # encrypts stored tokens at rest
```
Set each provider's redirect URI to `${APP_URL}/api/social/oauth/<platform>/callback`.
Connected platforms then show a "Connect" (OAuth) button on `/audit`; the rest stay manual.
Note: X and TikTok require PKCE S256 (scaffold uses a placeholder challenge — finish S256 when enabling them).

## Production notes (SQLite → Postgres)

Local dev uses SQLite for zero setup. For production:

1. Change `datasource.provider` in `prisma/schema.prisma` to `postgresql` and set a
   Postgres `DATABASE_URL`.
2. Restore native enums/arrays and add **pgvector** for AI coach memory.
3. Move the leaderboard to **Redis** sorted sets and run AI grading / social audits
   as **async workers** (see `docs/PLATFORM.md` §13).

## Project structure

```
src/
  app/
    (auth)/            login & signup
    (app)/             authenticated area (dashboard, courses, learn, leaderboard)
    api/               route handlers (auth, lessons, quizzes, assignments)
  components/          shared UI (progress rings, stats, nav)
  lib/
    auth.ts            sessions, hashing, JWT
    gamification.ts    XP ledger, levels, streaks, badges
    progression.ts     gated course-tree unlocking
    leaderboard.ts     composite scoring
    ai-review.ts       AI assignment reviewer (+ mock)
    constants.ts       levels, statuses, XP thresholds
prisma/
  schema.prisma        data model
  seed.ts              sample course, badges, missions, demo user
```

## Roadmap (next phases)

See `docs/PLATFORM.md` §15. Next up: AI Coach (RAG memory), social media audit
ingestion, weekly missions UI, career roadmap generator, community, and the admin
dashboard.
