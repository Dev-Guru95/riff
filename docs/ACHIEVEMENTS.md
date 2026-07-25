# Badges & Certificate — Achievement System

How Riff awards badges and the program certificate, where the data lives, and
what a designer needs to replace before launch.

---

## 1. The achievement structure (and why)

The program is a set of ordered **courses** (a.k.a. *tracks*) → modules → lessons.
Achievements sit on top of the existing gamification (XP, levels, streaks, milestones):

| Reward | Trigger | Count |
|---|---|---|
| **Journey badges** | Cross-cutting activity milestones (first lesson, 3 quizzes passed, first review, 7-day streak, 10 missions) | **5** (pre-existing) |
| **Track badges** | Completing *every lesson* in a course/track | **1 per track** (auto-generated) |
| **Program capstone badge** | Completing the whole program | **1** |
| **Program certificate** | Completing the whole program | **1** |

**Why this count?** The brief warned against badge fatigue (no badge-per-lesson,
no 10-per-track). Badges are pegged to **tracks** — a large unit of work — plus a
handful of career-shaped journey badges. So the badge wall grows by *one* per
track, not per lesson. Today's single seeded course yields **7 badges total**
(5 journey + 1 track + 1 capstone). A 5-track program would total 11 — still
comfortably motivating, never spammy.

The **certificate is deliberately singular**: one credential for finishing the
entire program, not one per course. Tracks are recognized with badges; the
program is recognized with the certificate.

---

## 2. Badge awarding logic

### Journey badges — `evaluateBadges()` in `src/lib/gamification.ts`
Unchanged. Runs inside `awardXp()` (via the `events.ts` layer) after every XP
event and awards any of the 5 criteria badges the user now qualifies for.
Idempotent via the `UserBadge` primary key `(userId, badgeId)`.

### Track badges — `awardTrackBadge()` in `src/lib/gamification.ts`
- **Trigger:** a course reaches 100% completion. Detected in
  `recomputeEnrollmentProgress()` (`src/lib/enrollment.ts`), which fires on the
  last lesson completion and delegates to `onCourseCompleted()`
  (`src/lib/achievements.ts`).
- **Metadata:** derived from the course by `trackBadgeMeta(course)` — a **pure**
  function. Key = `track:<courseSlug>` (slug-based so it survives re-seeding),
  name = `"<Course Title> Graduate"`, tier `gold`, icon `🎖️`.
- **Storage:** the `Badge` row is **lazily upserted** on first award, so a course
  an admin creates needs *zero* extra badge setup. The award is a `UserBadge` row.
  The seed also pre-creates track badges for published courses so they appear
  (dimmed) on the badge wall before being earned.
- **Idempotency:** upsert-by-key for the `Badge`; `UserBadge` PK for the award.
  Re-completing a course never double-awards.

### Program capstone badge — `program_graduate`
Seeded, awarded alongside the certificate inside `issueProgramCertificate()`.

### Display
- **Dashboard → Achievements section** (`src/app/(app)/dashboard/page.tsx`):
  every badge, dimmed until earned, rendered by the `Badge` component
  (`src/components/ui.tsx`) using placeholder art.
- **Completed course page** (`src/app/(app)/courses/[slug]/page.tsx`): a banner
  with the earned track badge + a Share-to-Skool button.
- **Toast** on the lesson that finishes a track (`LessonPlayer.tsx` →
  `celebrate()`), plus an in-app **notification** and a Share-to-Skool suggestion.

---

## 3. Certificate awarding logic

`src/lib/certificates.ts`

- **Program completion** = the user has a completed enrollment for **every
  published course**. Pure rule: `isProgramCompleteFrom(publishedIds, completedIds)`;
  DB wrapper: `isProgramComplete(userId)`.
- **Issuing:** `issueProgramCertificate(userId)` creates one `Certificate`
  (`programKey = "riff"`), awards the capstone badge, notifies, and tracks the
  `certificate_issued` analytics event. Returns `null` if the program is
  incomplete or already certified.
- **Idempotency:** the `@@unique([userId, programKey])` constraint means a second
  call is a no-op — safe to invoke on every course completion.
- **Display:** `/certificates` (`src/app/(app)/certificates/page.tsx`) shows the
  certificate via `<CertificateArtwork>` with a Share-to-Skool button once earned,
  or a **per-track progress checklist** ("2 of 3 tracks complete") until then. The
  dashboard Achievements section has a certificate strip mirroring this state.

### Previously-completed tracks / backfill
`backfillAchievements(userId?)` in `src/lib/achievements.ts` replays
`onCourseCompleted()` for every already-completed enrollment, granting any badge
or certificate a learner earned before this feature shipped. Idempotent; safe to
run repeatedly. Call it once after deploy (or per-user on next login).

---

## 4. Placeholder assets — REPLACE BEFORE PRODUCTION

All achievement art is placeholder and swappable with **no code changes**. The
single source of truth for paths is `src/lib/assets.ts`.

| Asset | File(s) to replace | Notes |
|---|---|---|
| Journey badges | `public/badges/first_steps.svg`, `quiz_whiz.svg`, `first_submission.svg`, `streak_7.svg`, `mission_marathon.svg` | Keep filenames |
| Capstone badge | `public/badges/program_graduate.svg` | Keep filename |
| Track badges | `public/badges/track.svg` | One shared file for **all** course badges |
| Fallback | `public/badges/_default.svg` | Used by any unmapped badge key |
| Certificate | `public/certificate/template.svg` **and/or** `src/components/CertificateArtwork.tsx` | The template SVG has `{{ARTIST_NAME}}` / `{{PROGRAM_TITLE}}` / `{{DATE}}` / `{{SERIAL}}` placeholders; the live UI renders the component |

To give a specific badge its own art (instead of the shared `track.svg`/default),
drop `public/badges/<key>.svg` and add its key to `STATIC_BADGE_ART` in
`src/lib/assets.ts`.

The emoji `icon` stored on each `Badge` row is used only in toasts/notifications
(where an image is awkward) and is likewise easy to change in the seed.

---

## 5. Data model & migration

- `Certificate` was converted from **per-course** to **per-program**: dropped
  `courseId`/the `Course` relation, added `programKey` (default `"riff"`), and
  changed the unique constraint to `@@unique([userId, programKey])`.
  Migration: `prisma/migrations/20260708180753_program_certificate/`.
- `Badge` / `UserBadge` were reused as-is — no schema change for badges.
- Program/track constants live in `src/lib/constants.ts`
  (`PROGRAM_KEY`, `PROGRAM_TITLE`, `PROGRAM_BADGE_KEY`, `trackBadgeKey`).

New surface area: `src/lib/achievements.ts` (the completion seam + backfill),
`src/lib/assets.ts`, `src/components/CertificateArtwork.tsx`, and additions to
`src/lib/gamification.ts` / `src/lib/certificates.ts`.

---

## 6. Tests

- `src/lib/achievements.unit.test.ts` — pure rules (program-completion logic,
  track-badge metadata).
- `src/lib/achievements.integration.test.ts` — the real awarding chain against a
  throwaway SQLite DB (never `dev.db`). Covers: a track awards the right badge,
  no double-award, certificate withheld until all tracks done, program completion
  issues the certificate + capstone, idempotent re-issue, and backfill of
  previously-completed tracks.

Run: `pnpm test` (or `npx vitest run`). The integration file pushes the schema to
a temp DB via `prisma db push`, so the Prisma CLI must be available.

---

## 7. Architectural decisions

1. **One program certificate, not per-course** — matches the brief's explicit
   preference and cleanly separates *track recognition* (badges) from *program
   recognition* (certificate).
2. **Lazy track-badge creation** — badges materialize from course metadata, so
   admin-created courses work with no manual badge authoring.
3. **Single completion seam** (`onCourseCompleted`) — all course-completion
   rewards live in one place, mirroring how `events.ts` centralizes per-action
   rewards. Wired into the existing `recomputeEnrollmentProgress` rather than
   scattered across API routes.
4. **Idempotency everywhere** — DB constraints (`UserBadge` PK,
   `Certificate` unique) are the guardrails, so replays, backfills, and
   re-completions are always safe.
5. **Assets decoupled from logic** — one resolver (`assets.ts`) + placeholder
   files/component, so the designer's work never touches awarding code.
