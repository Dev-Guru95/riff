# Riff — UI/UX Designer Handover

> **Who this is for:** the UI/UX designer taking over the visual and interaction design of Riff.
> **What this is:** everything you need to understand the product, run it locally, see every screen, and know what already exists so you can redesign confidently.
> **Current state in one line:** the app is **fully functional end-to-end** but the UI is **engineer-built and deliberately minimal** — a dark, utilitarian baseline with a tiny hand-rolled component set. Your job is to make it *feel* like the product it wants to be. Nothing here is precious; treat all of it as a starting point.

---

## 1. What Riff is (context in 60 seconds)

**Riff is a gamified, AI-powered education platform that teaches independent musicians the _business_ of a music career** — marketing, branding, fan growth, streaming, release strategy. Think **Duolingo's engagement × Coursera's structure × ChatGPT's intelligence**, applied to the music business.

The core loop artists live in:

> **Learn** a lesson → **do** a real-world challenge → **submit** it for an instant AI score + feedback → **earn** XP, badges, streaks → **share** the win with the community → **next lesson unlocks.**

Product pillars you'll be designing around:

- **Structured courses** — Course → Module → Lesson → Quiz → Assignment, with *gated progression* (a lesson unlocks only when the previous one is done).
- **Gamification** — XP, 9 levels (Beginner Artist → Music Entrepreneur), daily streaks, badges, progress rings/bars. This is where most of the "feel" lives — it should be celebratory and motivating.
- **AI features** — assignment review (score + strengths/weaknesses/next actions), an AI Artist Coach (streaming chat mentor), a Career Roadmap generator, and a Social Media Audit.
- **Community & competition** — forums, peer feedback, leaderboards (global/country/genre), weekly missions.
- **Admin** — a full role-gated back office for authoring courses, reviewing AI scores, moderation, etc.

> Deeper product background lives in `PLATFORM.md` and `APP_BRIEF_FOR_COURSE.md`. Read those if you want the full story; this doc is the design-focused subset.

---

## 2. Run it locally (so you can click through everything)

You don't need to be a developer to get this running — it's a few commands. From the project root:

```bash
pnpm install
pnpm db:migrate      # creates the local SQLite database
pnpm db:seed         # loads a sample course, badges, missions, and a demo user
pnpm dev             # → http://localhost:3000
```

**Log in with the seeded accounts:**

| Role | URL | Email | Password |
|---|---|---|---|
| **Artist** (the main experience) | `/login` | `demo@riff.app` | `password123` |
| **Admin** (the back office) | `/login` → then `/admin` | `admin@riff.app` | `admin12345` |

Everything works offline — the AI features fall back to a deterministic mock when no API key is set, so you'll see real, populated screens (scores, feedback, coach replies) without any setup.

> If `pnpm` isn't installed: `npm i -g pnpm`. If you get stuck on setup, grab a developer for 5 minutes — it's a one-time thing.

---

## 3. The screen inventory (your redesign surface)

Every screen in the product, grouped by area. **File paths are included** so you (or a dev pairing with you) can find exactly what renders each one. Routes in `()` groups like `(app)` are organizational — they don't appear in the URL.

### Marketing / entry
| Screen | Route | File |
|---|---|---|
| Landing page | `/` | `src/app/page.tsx` |

### Auth
| Screen | Route | File |
|---|---|---|
| Log in | `/login` | `src/app/(auth)/login/page.tsx` |
| Sign up | `/signup` | `src/app/(auth)/signup/page.tsx` |

### Artist app (the heart of the product — spend most of your time here)
| Screen | Route | File |
|---|---|---|
| **Dashboard** — level, XP, streak, ranks, badges, "next best action" | `/dashboard` | `src/app/(app)/dashboard/page.tsx` |
| Courses list | `/courses` | `src/app/(app)/courses/page.tsx` |
| Course detail (modules/lessons) | `/courses/[slug]` | `src/app/(app)/courses/[slug]/page.tsx` |
| **Lesson player** — lesson + quiz + assignment submit, celebration toasts | `/learn/[lessonId]` | `src/app/(app)/learn/[lessonId]/page.tsx` |
| **AI Coach** — streaming chat mentor | `/coach` | `src/app/(app)/coach/page.tsx` |
| Weekly missions | `/missions` | `src/app/(app)/missions/page.tsx` |
| Social media audit — 4 scores + month-over-month deltas | `/audit` | `src/app/(app)/audit/page.tsx` |
| Career roadmap generator | `/roadmap` | `src/app/(app)/roadmap/page.tsx` |
| Community (groups) | `/community` | `src/app/(app)/community/page.tsx` |
| Community group | `/community/[slug]` | `src/app/(app)/community/[slug]/page.tsx` |
| Community thread | `/community/thread/[id]` | `src/app/(app)/community/thread/[id]/page.tsx` |
| Leaderboard (global/country/genre) | `/leaderboard` | `src/app/(app)/leaderboard/page.tsx` |
| Pricing / plans | `/pricing` | `src/app/(app)/pricing/page.tsx` |
| Certificates & badges | `/certificates` | `src/app/(app)/certificates/page.tsx` |
| Billing settings | `/settings/billing` | `src/app/(app)/settings/billing/page.tsx` |

### Admin (back office — role-gated, lower design priority but part of the package)
| Screen | Route | File |
|---|---|---|
| Overview + KPIs | `/admin` | `src/app/(admin)/admin/page.tsx` |
| Course authoring | `/admin/courses`, `/admin/courses/[id]` | `src/app/(admin)/admin/courses/…` |
| Content suggestions | `/admin/content` | `src/app/(admin)/admin/content/page.tsx` |
| Assignment review queue | `/admin/submissions` | `src/app/(admin)/admin/submissions/page.tsx` |
| Moderation queue | `/admin/moderation` | `src/app/(admin)/admin/moderation/page.tsx` |
| Users | `/admin/users` | `src/app/(admin)/admin/users/page.tsx` |
| Coupons & rewards | `/admin/coupons` | `src/app/(admin)/admin/coupons/page.tsx` |
| Course import | `/admin/import` | `src/app/(admin)/admin/import/page.tsx` |
| Security / MFA | `/admin/security` | `src/app/(admin)/admin/security/page.tsx` |

**The app shell:** the artist-facing app uses a sticky **top nav** (`TopNav` in `src/components/ui.tsx`, applied via `src/app/(app)/layout.tsx`) — one bar, ~10 links wide, over a `max-w-5xl` centered container, no sidebar. The **admin** area uses a different shell: a **left sidebar** (`src/app/(admin)/admin/layout.tsx`). So there are already two navigation paradigms in the product. Whether the top nav scales (it's already crowded, and won't survive mobile) is an open design question — see §6.

---

## 4. The current design system (what exists today)

This is intentionally lightweight. Knowing it means you know exactly what to replace vs. extend.

### Theme tokens
All color is driven by CSS custom properties in **`src/app/globals.css`**. It's a **dark theme only** right now (no light mode). The full palette:

| Token | Value | Role |
|---|---|---|
| `--background` | `#0a0a0f` | app background (near-black) |
| `--surface` | `#14141c` | cards |
| `--surface-2` | `#1c1c28` | inputs, secondary surfaces |
| `--border` | `#2a2a3a` | hairlines |
| `--foreground` | `#ededf2` | primary text |
| `--muted` | `#9a9ab0` | secondary text |
| `--brand` | `#8b5cf6` | violet — primary brand |
| `--brand-2` | `#ec4899` | pink — used in brand gradient |
| `--accent` | `#22d3ee` | cyan — progress, highlights |
| `--success` | `#34d399` | green |
| `--warning` | `#fbbf24` | amber |

The signature visual is the **violet→pink gradient** (primary buttons) and **violet→cyan gradient** (progress fills). Tokens are exposed to Tailwind 4 via `@theme inline`, so classes like `bg-surface`, `text-muted`, `border-border`, `text-brand` work throughout.

### Typography
One typeface: **Geist Sans** (via `next/font`, wired in `src/app/layout.tsx`). No type scale is formalized — sizes are ad-hoc Tailwind utilities (`text-xl`, `text-sm`, etc.). **A real type system is a good early win for you.**

### Components (the entire shared set — it's small)
| Component | File | Notes |
|---|---|---|
| `ProgressBar`, `ProgressRing` | `src/components/ui.tsx` | XP/completion visuals |
| `Stat` | `src/components/ui.tsx` | icon + value + label tile (uses emoji icons) |
| `Badge` | `src/components/ui.tsx` | badge chip; art is swappable SVG |
| `TopNav` / `NavLink` | `src/components/ui.tsx` | the app shell nav |
| `NotificationBell` | `src/components/NotificationBell.tsx` | unread-count bell |
| `Pagination` | `src/components/Pagination.tsx` | |
| `ProGate` | `src/components/ProGate.tsx` | upsell gate for Pro features |
| `ShareToSkool` | `src/components/ShareToSkool.tsx` | share-to-community action |
| `CertificateArtwork` | `src/components/CertificateArtwork.tsx` | |
| `GoalRow`, `LogoutButton` | `src/components/…` | |

Beyond these, most UI is **inline `className` markup written per-page** using three global CSS helper classes in `globals.css`: `.card`, `.btn` (`.btn-primary` / `.btn-ghost`), and `.progress-track` / `.progress-fill`. There is **no component library** (no shadcn, MUI, Radix, etc.) and no Figma file yet — this is a greenfield opportunity to define a proper system.

### Icons & illustration
- **Icons are emoji** (🎯, 🔥, ⭐) inlined as text. No icon set is installed. Choosing a real icon library is on the table.
- **Badge & certificate art are placeholder SVGs** in `public/badges/` and `public/certificate/`. They're designed to be **swapped file-for-file with no code changes** (mapping lives in `src/lib/assets.ts`) — a clean, self-contained deliverable for you.

### Motion
Minimal: one `pop-in` keyframe for celebration moments, `progress-fill` width transitions, and a global `prefers-reduced-motion` guard. Gamification moments (level-up, badge unlock) are the natural place to invest in delightful motion.

---

## 5. Constraints & conventions to design within

These aren't blockers — they're the grain of the material. Designing with them makes handoff-to-code frictionless.

- **Stack:** Next.js 16 (App Router, React Server Components), React 19, **Tailwind CSS 4**, TypeScript. Styling is Tailwind utilities + CSS variables. If your designs map to Tailwind tokens, implementation is nearly 1:1.
- **Server-first rendering:** most pages are Server Components; interactive pieces are Client Components (`"use client"`). Practically this means **richly interactive widgets are fine, but the base is fast, mostly-static rendering.** No SPA routing tricks needed.
- **Dark-first.** If you want a light mode, that's a real design decision to raise — the token system supports it but nothing is built for it yet.
- **Responsive matters.** Artists are described as a **mobile-first** audience (the product concept is a phone app), but the current web build is desktop-centered (`max-w-5xl`, a wide top nav). **Reconciling mobile-first intent with the current desktop layout is arguably the single biggest UX question.** See below.
- **Accessibility:** keep contrast, focus states, and reduced-motion in mind — there's a reduced-motion guard already; extend the same care to focus rings and color contrast.

---

## 6. Open questions worth raising early

Good things to align on with the boss/team before deep design work:

1. **Mobile-first vs. current desktop layout** — the product vision is a mobile app; the web build is desktop-centered. Which is the priority surface, and do we need both fully designed?
2. **Navigation model** — the single wide top nav (~10 links) is already crowded and won't survive mobile. Sidebar? Bottom tab bar? Grouped nav? This affects every screen.
3. **Light mode?** — dark-only today. Add it or commit to dark.
4. **Brand identity** — is the violet/pink/cyan palette and "Riff" wordmark locked, or open to a full brand exploration? (Note: product/course docs also use the name "Soundring" — **confirm the canonical product name**, it's currently ambiguous across docs.)
5. **Design tooling & deliverable format** — Figma file + design tokens? A component spec? Redlines? Agree on what "done" looks like for handoff back to engineering.
6. **Scope of admin** — should the admin back office get the full design treatment, or a lighter "make it usable" pass while artist-facing screens get the polish?
7. **Icon & illustration direction** — replace emoji with a real icon set; define badge/illustration art style.

---

## 7. What's in this handover package

- **This document** (`HANDOVER_FOR_DESIGNER.md`) — your map.
- **`PLATFORM.md`** — product positioning, feature list, and user-flow diagrams.
- **`APP_BRIEF_FOR_COURSE.md`** — the product experience/journey and terminology (written for course authors, but great product context).
- **`README.md`** — full feature list + engineering/setup detail.
- **`ACHIEVEMENTS.md`** — how badges/certificates work (relevant since their art is a design deliverable).
- **The running app** — seeded and clickable via §2. This is the real reference; the docs describe intent, the app shows the current reality.

**Suggested first hour:** run the app (§2), log in as the artist, and click through the loop — Dashboard → Courses → a Lesson → submit the assignment → see the AI feedback → check the Leaderboard and Community. Then log in as admin and skim `/admin`. That end-to-end pass will tell you more than any doc.

---

*Questions on any of this should go to the engineering team — happy to walk through the codebase, set up your environment, or clarify how any screen behaves.*
