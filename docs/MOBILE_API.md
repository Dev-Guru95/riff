# Riff API for the native (Expo) app

The native app talks to the same Next.js backend as the web app. Every web
screen is a Server Component that reads the database directly, so for screens
with no JSON GET endpoint there are additive, read-only endpoints under
`/api/mobile/*`. They return the same data the matching `page.tsx` computes,
using the same `src/lib` calls, ordering and derived values. All writes go
through the existing routes the web already uses.

- **Response types:** `src/lib/mobile/types.ts`. The file is plain TypeScript
  with no imports, so you can copy it into the app as-is.
- **Endpoint code:** `src/app/api/mobile/**`, with small helpers in
  `src/lib/mobile/{server,tracks,staff}.ts`.

---

## 1. Auth

### Log in

```
POST /api/auth/login
x-riff-client: native
Content-Type: application/json

{ "email": "a@b.com", "password": "…" }
```

| Result | Body |
|---|---|
| 200 | `{ id, email, role, token }`. `token` is a 30-day JWT. It is only included because of the `x-riff-client: native` header. |
| 200 (MFA) | `{ mfaRequired: true }`. No session is created. Send the same POST again with `"code": "123456"` (the TOTP code). |
| 401 | Bad credentials, or `"Invalid authentication code"`. |
| 403 | The account is not active. |
| 422 | `{ error: "Validation failed", issues }` |
| 429 | Rate limited: 10/min per IP. Read the `Retry-After` header. |

### Sign up

```
POST /api/auth/signup
x-riff-client: native

{ email, password (min 8), stageName?, genres?: string[], countryCode?: "US" (2 chars), ref?: string (≤64) }
```

- Returns 201 `{ id, email, role, token }`, or 409 if the email already exists.
- Signup automatically enrolls the artist in the first published course.

### Every other request

Send `Authorization: Bearer <token>` on every request. `getSession()` accepts
the bearer token or the web cookie. The admin endpoints re-read the role from
the database, so a demoted or suspended user loses staff access straight away.

### Log out

`POST /api/auth/logout` only clears the web cookie. **It does not revoke a
bearer JWT.** The app logs out by deleting the token it stored. The token
otherwise stays valid until it expires (30 days).

### Delete the account

```
DELETE /api/account
{ password, confirm: "DELETE" }
```

- Returns `{ deleted: true, billingNeedsAttention }`.
- Errors: 401 wrong password, 409 when the account is the last admin.

### Error shape

Every error is JSON `{ error: string, ...extra }`.

| Status | Meaning |
|---|---|
| 401 | Not authenticated |
| 403 | Forbidden or locked |
| 404 | Not found |
| 402 | Plan quota reached |
| 422 | Validation failed. The body includes `issues`. |
| 429 | Rate limited. Read the `Retry-After` header. |
| 500 | Sanitized error message |

### Site-relative paths

Some fields hold paths on the web origin, such as `image`
(`/badges/<key>.svg`), upload URLs (`/uploads/<uid>/<file>`) and `redirectTo`
(`/learn/<id>`). Prefix them with the API base URL.

### Dates and JSON columns

- Dates are ISO-8601 strings.
- Columns stored as JSON strings are already parsed into arrays or objects:
  `genres`, `goals`, quiz `options`, `acceptedTypes`, `rubric`, roadmap
  `plan`, audit `deltas` and `recommendations`, `sourceUrls`, `artifactUrls`.

---

## 2. New read endpoints: `/api/mobile/*`

All of these are `GET`, need a session (401 otherwise) and are typed in
`src/lib/mobile/types.ts`.

| Endpoint | Web page mirrored | Response type | Notes |
|---|---|---|---|
| `/api/mobile/me` | `(app)/layout.tsx` + `settings/page.tsx` | `MeResponse` | Includes `user` (role re-read from the DB, `isStaff`, `mfaEnabled`), `skool` (member, requestedAt, joinedAt, handle, status), `profile` (genres and goals parsed), `plan` (`subscription?.plan ?? "free"`) and `subscription`. Never returns passwordHash or mfaSecret. |
| `/api/mobile/dashboard` | `dashboard/page.tsx` | `DashboardResponse` | Includes: <br>• `level` from `resolveLevel` (plus `levelNumber` and `xpToNextLevel`) <br>• streak, ranks <br>• the enrollment, `nextLesson` and `courseProgress`, plus `courseComplete` <br>• daily and weekly goals, milestones <br>• the full badge wall in `orderIndex, key` order, each badge with `earned`, `earnedAt` and `image` <br>• program progress, the certificate <br>• `shares.level` and `shares.leaderboard`, the payloads for the dashboard's ShareToSkool buttons |
| `/api/mobile/courses` | `courses/page.tsx` | `CoursesResponse` | Published courses ordered by `orderIndex, slug`. Each has module and lesson counts and the artist's `enrollment` (or null). |
| `/api/mobile/courses/[slug]` | `courses/[slug]/page.tsx` | `CourseDetailResponse` | **Writes:** upserts the Enrollment, as visiting the page does. <br>Returns the tree with lesson statuses, `completed`, track `badge` (with `image`), `share` (only once completed) and `returnLink`. <br>Also returns `quizLessonId` and `stepLessonIds` (step *n* = `stepLessonIds[n-1]`), so deep links can be resolved without another request. The page does not check `isPublished`, so neither does this endpoint. |
| `/api/mobile/courses/[slug]/quiz` | `courses/[slug]/quiz/page.tsx` | `TrackLinkResolveResponse` | **Writes:** upserts the Enrollment. <br>Returns `{ lessonId, redirectTo }` instead of redirecting. `redirectTo` is `/learn/<id>`, or `/courses/<slug>` when the track has no quiz. |
| `/api/mobile/courses/[slug]/step/[n]` | `courses/[slug]/step/[n]/page.tsx` | `TrackLinkResolveResponse` | Same as the quiz endpoint. A step number that isn't a positive integer returns 404. A step the track doesn't have returns `redirectTo: /courses/<slug>`. |
| `/api/mobile/lessons/[id]` | `learn/[lessonId]/page.tsx` | `LessonResponse` | **Writes:** upserts LessonProgress to `in_progress`. A lesson that is already completed stays completed. <br>Returns the markdown `content`, `alreadyCompleted`, and the quiz **without correct answers** (the server grades). <br>Also returns `assignment` (with `acceptedTypes`), `prevLessonId`/`nextLessonId`, `returnLink` (only on the last lesson of the track) and `latestSubmission` (the same data as `GET /api/assignments/[id]/submissions`). <br>404 if the lesson doesn't exist. 403 `{ error, locked: true, courseSlug }` if the lesson is locked; today `isLessonUnlocked` is always true. |
| `/api/mobile/certificates` | `certificates/page.tsx` | `CertificatesResponse` | Returns the certificate (or null), `recipient` (stage name, or "you"), program track progress and the certificate `share`. |
| `/api/mobile/roadmaps` | `roadmap/page.tsx` | `RoadmapsResponse` | `plans` is keyed by horizon (`30d`, `90d`, `6m`, `12m`), with each plan parsed. A missing key means that plan hasn't been generated yet. The horizon tab labels live inside the client component, so the app supplies its own. |
| `/api/mobile/leaderboard?page=N` | `leaderboard/page.tsx` | `LeaderboardResponse` | Global board only (the page has no other scopes), 50 rows per page. Returns `hasNext`, `total`, `rows` (each with `isMe`), `me` and `share`. Country and genre ranks for the current artist are in `dashboard.ranks`. |
| `/api/mobile/missions` | `missions/page.tsx` | `MissionsResponse` | **Writes:** on the first visit of a week, creates that week's mission set (`ensureWeeklyMissions`), as the page does. |
| `/api/mobile/studio` | `studio/page.tsx` | `StudioHubResponse` | Only the AI `builders` (`BUILDERS` from `src/lib/studio`). See Gaps (§5). |
| `/api/mobile/studio/[kind]` | `studio/[kind]/page.tsx` | `StudioBuilderResponse` | Returns builder metadata (rubric, placeholder, instructions) and the artist's drafts. 404 for an unknown kind. |
| `/api/mobile/studio/dashboard` | `studio/dashboard/page.tsx` | `StudioDashboardResponse` | Level, streak, badge count, finance totals (in cents), fan, board, open-task and gig counts, and up to 5 active goals plus `activeGoalCount`. |
| `/api/mobile/community` | `community/page.tsx` | `CommunityResponse` | Returns `status` (`member`, `pending` or `none`) and `skoolUrl`. <br>For members, `redirectTo` is the Skool URL; the web page redirects them there. Everyone else sees the onboarding. `alreadyRequested` means the status is pending. |
| `/api/mobile/coach` | `coach/page.tsx` | `CoachResponse` | Non-members get `{ locked: true, status, pending }` with a 200, matching the page's locked state. <br>For members it **writes:** finds the latest thread or creates one. It returns `thread`, `messages` (including `feedback`) and `stageName`. |
| `/api/mobile/audit` | `audit/page.tsx` | `AuditResponse` | Returns `oauthProviders` and social `accounts` (id, platform, handle, connectVia, status, connectedAt; **never tokens**). Also returns the latest `report` (parsed) and `runCount`. |
| `/api/mobile/billing` | `pricing/page.tsx` + `settings/billing/page.tsx` | `BillingResponse` | Returns `plans` (free, pro, premium; Stripe price ids are not included) and `currentPlan`. Only an active or trialing subscription counts toward `currentPlan`. Also returns `billingConfigured`, `entitlements` and `subscription` (plan, status, currentPeriodEnd). |
| `/api/mobile/boards/dashboard` | `boards/page.tsx` (my-work panel) | `DashboardDTO` (src/lib/boards.ts) | `loadDashboard()`: open/completed counts, due today, overdue, upcoming, board progress, workload. |

### Admin (staff only)

The gate is the same as `(admin)/admin/layout.tsx`: any **active** admin,
reviewer or moderator, with the role re-read from the DB. Without a session
these endpoints return 401; for a non-staff user they return 403. No admin
page adds a per-page role check of its own, so neither do these endpoints. The
*write* routes do check roles (see §3), and the roles are **not** a hierarchy:
`requireAdmin(x)` admits only `admin` or exactly `x`.

| Endpoint | Web page | Response type | Notes |
|---|---|---|---|
| `/api/mobile/admin/overview` | `admin/page.tsx` | `AdminOverviewResponse` | Counts, completion and activation rates, 30-day KPIs, the funnel and signup sources. |
| `/api/mobile/admin/users?q=&page=&pending=1` | `admin/users/page.tsx` | `AdminUsersResponse` | 50 users per page. `q` is a case-insensitive email search. `pending=1` returns only the Skool access requests, oldest first. `pendingCount` covers all pages. Fields are selected explicitly, so no secrets are returned. |
| `/api/mobile/admin/courses` | `admin/courses/page.tsx` | `AdminCoursesResponse` | All courses, published and drafts. |
| `/api/mobile/admin/courses/[id]` | `admin/courses/[id]/page.tsx` | `AdminCourseDetailResponse` | The full editor tree, including quiz questions **with `correct`**, assignments (rubric, xp, pass mark), return link fields and `fallbackReturnUrl`. |
| `/api/mobile/admin/content` | `admin/content/page.tsx` | `AdminContentResponse` | The latest 50 suggestions, split into `pending` and `resolved`. |
| `/api/mobile/admin/coupons` | `admin/coupons/page.tsx` | `AdminCouponsResponse` | |
| `/api/mobile/admin/moderation?status=open\|dismissed\|resolved\|all` | `admin/moderation/page.tsx` | `AdminModerationResponse` | The latest 100 reports, each with a `preview` (post body, thread title or user email, or `"(deleted)"`). |
| `/api/mobile/admin/submissions?status=flagged\|reviewed\|all` | `admin/submissions/page.tsx` | `AdminSubmissionsResponse` | The latest 50 submissions. |
| `/api/mobile/admin/security` | `admin/security/page.tsx` | `AdminSecurityResponse` | `{ email, mfaEnabled }` |

---

## 3. Existing routes the app uses, by screen

The request bodies below are transcribed from each route's zod schema.
`?` marks an optional field and `=x` is the default value.

### Rate-limit buckets

| Bucket | Limit |
|---|---|
| auth | 10/min per IP |
| ai | 20/min per user |
| write | 60/min per user |

### Lesson player

| Method & path | Body | Response |
|---|---|---|
| `POST /api/lessons/[id]/complete` | none | `{ xp, streak, shares, courseProgress }`. Idempotent. 403 if the lesson is locked. |
| `POST /api/quizzes/[id]/attempts` | `{ answers: { [questionId]: optionId[] } }` | `{ score, passed, passThreshold, perQuestion: [{questionId, isCorrect, explanation}], xp, streak, shares }` |
| `GET /api/assignments/[id]/submissions` | n/a | `{ submission: null \| {id, textContent, externalLink, artifactUrls, status, aiScore, submittedAt, review} }` |
| `POST /api/assignments/[id]/submissions` (ai) | `{ artifactType: "text"\|"link"\|"image"\|"audio"\|"video"\|"pdf" ="text", textContent?, externalLink?: url, artifactUrls?: url[] }`, with at least one content field | `{ submissionId, status: "reviewed"\|"flagged", review, passed, flaggedForHumanReview, xp, streak, shares }` |
| `POST /api/uploads` (write) | **multipart**, field name **`file`** | 201 `{ url: "/uploads/<uid>/<name>", category, size }`. Details below. |

The web player completes a lesson in one of two ways:

- When there is reading content, it POSTs `complete` from the reading step.
- When there isn't, it POSTs `complete` once the last quiz or assignment step
  is finished.

Do the same.

**Upload limits:** files can be up to 25 MB. Allowed types are png, jpeg,
webp, gif, mp3 (`audio/mpeg`), wav, m4a (`audio/mp4`), mp4, mov (`video/quicktime`) and pdf.
Magic bytes are checked for pdf, png, jpeg and gif.

### Learning extras

| Method & path | Body | Response |
|---|---|---|
| `POST /api/missions/[id]/complete` | none | `{ xp, streak }` |
| `POST /api/roadmap` (ai) | `{ horizon: "30d"\|"90d"\|"6m"\|"12m" }` | `{ id, horizon, plan }` |
| `POST /api/coupons/redeem` | `{ code }` (uppercased) | `{ code, type, value, description }`. Errors: 404, 409, 410. |
| `GET /api/notifications` | n/a | `{ items (latest 30), unread }` |
| `POST /api/notifications` | `{ id? }` | `{ success: true }`. Without `id`, marks everything read. |

### Coach

| Method & path | Body | Response |
|---|---|---|
| `GET /api/coach/threads` | n/a | `{ threads }` (latest 30) |
| `POST /api/coach/threads` | none | 201 `{ id }`. Non-members get 403 `{ error, reason: "community_required" }`. |
| `GET /api/coach/threads/[id]/messages` | n/a | `{ messages }` |
| `POST /api/coach/threads/[id]/messages` | `{ content: string 1–2000 }` | **SSE stream**, described below |
| `PATCH /api/coach/messages/[id]` | `{ feedback: "up"\|"down"\|null }` | `{ feedback }` |

**How the SSE stream works:**

1. The route first runs these checks, in order, and answers a failure as
   plain JSON with no stream:
   - 401 if there is no session
   - 403 `reason: "community_required"` for non-members
   - 429 if rate limited
   - 402 when the daily coach quota is used up
   - 422 if the body fails validation
   - 404 if the thread isn't the artist's

   **Check `content-type` before reading the body.** An error response is
   `application/json`; a successful one is `text/event-stream`.
2. On success the server sends events separated by a blank line (`\n\n`):
   ```
   data: {"id":"<assistantMessageId>"}

   data: {"delta":"Hey"}

   data: {"delta":" "}

   …
   data: {"done":true}
   ```
   - The first event carries the id of the assistant message.
   - Each following `delta` is a word or a whitespace token. Append them in order.
   - The stream closes after `done`.
3. Both messages are saved in the DB before streaming starts, so
   `GET /api/coach/threads/[id]/messages` can reload them.

React Native's `fetch` doesn't stream response bodies. Use a streaming fetch
polyfill or XHR `onprogress`, or just reload the messages after the request
finishes.

### Community

| Method & path | Body | Response |
|---|---|---|
| `POST /api/community/join` | `{ handle?: string ≤60 }` | `{ requested: true }`. This records a request; an admin has to verify it. |

### Social audit

| Method & path | Body | Response |
|---|---|---|
| `POST /api/social/connect` | `{ platform: instagram\|tiktok\|youtube\|facebook\|x\|spotify, handle: 1–64 }` | 201 `{ id, platform, handle }` (manual connect) |
| `DELETE /api/social/connect?platform=x` | n/a | `{ success: true }` |
| `POST /api/audit/run` (ai) | none | `{ report, totalFollowers }` |
| `GET /api/audit/run` | n/a | `{ report \| null }` |

`GET /api/social/oauth/[platform]/start` and `.../callback` only work in a
browser. They are cookie-based and redirect back to `/audit`. A native app
can't use them with a bearer token, so use the manual connect.

### Billing

| Method & path | Body | Response |
|---|---|---|
| `GET /api/billing/status` | n/a | `{ plan, coachMessagesPerDay, socialConnections, allCourses, humanReview, billingConfigured }` |
| `POST /api/billing/checkout` | `{ plan: "pro"\|"premium" }` | `{ url }` (Stripe Checkout; open it in a browser). 503 if Stripe isn't configured. |
| `POST /api/billing/portal` | none | `{ url }`. 400 if there is no Stripe customer; 503 if Stripe isn't configured. |

App-store payment policies may apply to linking out to Stripe from a native app.

### Settings and MFA

| Method & path | Body | Response |
|---|---|---|
| `POST /api/auth/mfa/setup` | none | `{ secret, otpauth }` |
| `POST /api/auth/mfa/enable` | `{ code: 6–8 chars }` | `{ enabled: true }` |
| `POST /api/auth/mfa/disable` | `{ code }` | `{ enabled: false }` |
| `DELETE /api/account` | `{ password, confirm: "DELETE" }` | `{ deleted: true, billingNeedsAttention }` |

### Studio

All Studio routes are scoped to the owner; a foreign id returns 404. Money
amounts are in cents.

| Method & path | Body | Response |
|---|---|---|
| `GET /api/studio/drafts?kind=` | n/a | `{ drafts }` |
| `POST /api/studio/drafts` | `{ kind, title? ≤120 }` | 201 `{ id }` |
| `GET` / `PATCH` / `DELETE /api/studio/drafts/[id]` | PATCH: `{ title?, content? ≤20000 }` | `{ draft }` / `{ ok: true }` |
| `POST /api/studio/drafts/[id]/score` (ai) | none | `{ draft }` |
| `POST /api/studio/caption` (ai) | `{ topic 1–500, platform: instagram\|tiktok\|youtube\|x\|facebook ="instagram", tone: authentic\|hype\|playful\|professional\|moody ="authentic" }` | captions result |
| `GET` / `PATCH /api/studio/brand-kit` | PATCH: `{ colors?: [{name, hex "#rgb…"}] ≤24, fonts?: [{name, usage}] ≤12, guidelines? ≤20000 }` | `{ kit }` |
| `POST /api/studio/brand-kit/assets` | `{ name, url: "/uploads/…" }` | 201 `{ id, name, url }` |
| `DELETE /api/studio/brand-kit/assets/[id]` | n/a | `{ ok: true }` |
| `GET` / `POST /api/studio/finance` | POST: `{ kind: income\|expense, category: streaming\|merch\|shows\|ads\|gear\|other, label, amount: int cents ≥1, date?: ISO }` | `{ entries, totals, byCategory }` / 201 `{ id }` |
| `DELETE /api/studio/finance/[id]` | n/a | `{ ok: true }` |
| `GET` / `POST /api/studio/merch-gigs` | POST: `{ type: "merch", name }` or `{ type: "gig", venue }` | `{ merch, gigs }` / 201 `{ id }` |
| `PATCH` / `DELETE /api/studio/merch/[id]` | `{ name?, status?: idea\|design\|production\|for_sale\|sold_out, cost?, price?, stock?, notes? }` | `{ ok: true }` |
| `PATCH` / `DELETE /api/studio/gigs/[id]` | `{ venue?, city?, date?: ISO\|""\|null, status?: inquiry\|confirmed\|done\|cancelled, fee?, notes? }` | `{ ok: true }` |
| `GET` / `POST /api/studio/goals` | POST: `{ title }` | `{ goals }` / 201 `{ id }` |
| `PATCH` / `DELETE /api/studio/goals/[id]` | `{ title?, detail?, targetDate?, progress? 0–100, milestones?: [{text, done}], status?: active\|done\|archived }` | `{ ok: true }` |
| `GET /api/studio/fans?tag=` | n/a | `{ fans, segments, total }` |
| `POST /api/studio/fans` | `{ name, email?, source?, tags?: string[] }` | 201 `{ id }` |
| `PATCH` / `DELETE /api/studio/fans/[id]` | `{ name?, email?, location?, tags?, source?, notes? }` | `{ ok: true }` |
| `GET` / `POST /api/studio/broadcasts` | POST: `{ subject }` | `{ broadcasts }` / 201 `{ id }` |
| `PATCH` / `DELETE /api/studio/broadcasts/[id]` | `{ subject?, body?, segment? }` | `{ ok: true }` |
| `POST /api/studio/broadcasts/[id]/send` | none | `{ recipientCount }` (recorded only; no email is sent) |
| `GET` / `POST /api/studio/bookings` | POST: `{ title }` | `{ bookings }` / 201 `{ id }` |
| `PATCH` / `DELETE /api/studio/bookings/[id]` | `{ title?, contact?, date?, status?: inquiry\|held\|confirmed\|done\|declined, fee?, notes? }` | `{ ok: true }` |
| `GET` / `PATCH /api/studio/link-page` | PATCH: `{ handle? 2–30, title?, bio?, theme?: brand\|accent\|success\|warning\|brand-2, links?: [{label, url}] ≤30, published? }` | `{ page }` |

### Boards (Kanban)

The boards feature already has a full JSON API.

- **Access:** a non-member gets 404. Role capabilities:

  | Capability | Minimum role |
  |---|---|
  | comment | guest |
  | editCards | member |
  | assignOthers, manageColumns, manageLabels | manager |
  | manageBoard, manageMembers | admin |
  | delete the board | owner |

- **Boards:**
  - `GET` / `POST /api/boards`. POST body: `{ title, kind: generic|content_calendar|release_planner|pitch_tracker|outreach_crm|collab_board }`.
  - `GET` / `PATCH` / `DELETE /api/boards/[id]`. PATCH body: `{ title?, description?, color?, archived? }`.
  - `GET /api/boards/[id]/activity`
  - `GET /api/boards/[id]/archive`
- **Columns:**
  - `POST /api/boards/[id]/columns` with `{ title }`
  - `GET /api/columns/[id]/cards?offset=`
  - `POST /api/columns/[id]/cards` with `{ title }`
  - `PATCH` / `DELETE /api/columns/[id]`. PATCH body: `{ title?, toIndex? }`.
- **Labels:**
  - `POST /api/boards/[id]/labels` with `{ name, color }`
  - `PATCH` / `DELETE /api/labels/[id]`
- **Members:**
  - `GET /api/boards/[id]/members?q=` (user search)
  - `POST /api/boards/[id]/members` with `{ email, role }`
  - `PATCH` / `DELETE /api/boards/[id]/members/[userId]`
- **Cards:**
  - `GET` / `PATCH` / `DELETE /api/cards/[id]`. PATCH body: `{ title?, description?, priority?, dueDate?, startDate?, estimateMinutes?, completion?, archived? }`.
  - `POST /api/cards/[id]/move` with `{ toColumnId, toIndex }`
  - `POST /api/cards/[id]/duplicate`
  - `POST` / `DELETE /api/cards/[id]/watch`
  - `GET /api/cards/[id]/activity`
- **Assignees:**
  - `POST /api/cards/[id]/assignees` with `{ userId }`
  - `DELETE /api/cards/[id]/assignees/[userId]`
- **Card labels:**
  - `POST /api/cards/[id]/labels` with `{ labelId }`
  - `DELETE /api/cards/[id]/labels/[labelId]`
- **Comments:**
  - `GET` / `POST /api/cards/[id]/comments`. POST body: `{ body }`.
  - `PATCH` / `DELETE /api/comments/[id]`
- **Checklists:**
  - `POST /api/cards/[id]/checklists` with `{ title }`
  - `PATCH` / `DELETE /api/checklists/[id]`
  - `POST /api/checklists/[id]/items` with `{ text }`
  - `PATCH` / `DELETE /api/checklist-items/[id]`. PATCH body: `{ text?, done? }`.
- **Attachments:**
  1. Upload the file with `POST /api/uploads`.
  2. Call `POST /api/cards/[id]/attachments` with `{ url: "/uploads/…", name, mime, size }`.
  3. Delete with `DELETE /api/attachments/[id]`.
- **Search:** `GET /api/search?q=`

### Admin writes

| Method & path | Role | Body |
|---|---|---|
| `PATCH /api/admin/users/[id]` | admin | `{ status?: active\|suspended, role?: artist\|admin\|reviewer\|moderator, skoolMember?: bool, plan?: free\|pro\|premium }` |
| `POST /api/admin/courses` | admin | `{ title, slug (a-z0-9-), description, level: beginner\|intermediate\|advanced }` |
| `PATCH` / `DELETE /api/admin/courses/[id]` | admin | `{ title?, description?, level?, isPublished?, returnUrl? (http(s) or "" to clear), returnLabel? ≤60 }` |
| `POST /api/admin/courses/[id]/modules` | admin | `{ title }` |
| `PATCH` / `DELETE /api/admin/modules/[id]` | admin | `{ title }` |
| `POST /api/admin/modules/[id]/lessons` | admin | `{ title, content, estMinutes=6, xpReward=20, quiz?: {passThreshold, questions:[{prompt, options:[{id,text}], correct: string[], explanation}]}, assignment?: {title, instructions, rubric, xpReward, minPassingScore} }` |
| `PATCH` / `DELETE /api/admin/lessons/[id]` | admin | `{ title?, content?, estMinutes?, xpReward? }` |
| `PUT /api/admin/lessons/[id]/quiz` | admin | `{ passThreshold, questions: [...] }`. An empty `questions` array removes the quiz. |
| `PUT /api/admin/lessons/[id]/assignment` | admin | `{ remove?: true }` or `{ title, instructions, xpReward?, minPassingScore? }` |
| `PATCH /api/admin/content-suggestions/[id]` | admin | `{ decision: approved\|rejected }` |
| `POST /api/admin/coupons` | admin | `{ code (A-Z0-9_-), type: percent\|fixed\|reward, value, description, maxRedemptions }` |
| `POST /api/admin/rewards/issue` | admin | `{ topN=1000, code="TOP1000" }` |
| `PATCH /api/admin/reports/[id]` | moderator | `{ action: resolve\|dismiss\|delete_content }` |
| `PATCH /api/admin/submissions/[id]` | reviewer | `{ aiScore 0–100, status: reviewed\|resubmit, note? }` |
| `POST /api/admin/import/parse`, `POST /api/admin/import` | admin | `parse` takes multipart field `file` (.docx/.pdf, up to 15 MB); `import` then takes `{ course, sourceFile }`. This is web-oriented and has no mobile read endpoint. |

### Server-only (never call these from the app)

- `POST /api/webhooks/stripe` is authenticated by the Stripe signature.
- `GET` / `POST /api/cron/due-soon` requires `CRON_SECRET`.
- `GET /api/health` is fine to use as a connectivity check.

---

## 4. Endpoints that write when you read them

These GET endpoints change data, matching what the web pages do when they
render:

| Endpoint | Write |
|---|---|
| `/api/mobile/courses/[slug]`, `/quiz`, `/step/[n]` | Upserts the Enrollment |
| `/api/mobile/lessons/[id]` | Upserts LessonProgress to `in_progress`, leaving a completed lesson completed |
| `/api/mobile/missions` | Creates the week's missions on the first visit of the week |
| `/api/mobile/coach` (members) | Creates a coach thread if the artist has none |

---

## 5. Gaps

- **Studio hub tiles.** The `AI_TOOLS` (Caption generator) and `MANAGERS`
  (Brand Kit, Fan CRM, …) tiles are declared inside
  `src/app/(app)/studio/page.tsx`, not in a module, so `/api/mobile/studio`
  returns only `BUILDERS`. The app hardcodes those tiles for now. Moving the
  arrays into `src/lib/studio.ts` would let this endpoint return them.
- **Static UI copy in client components.** This includes the community
  onboarding `BENEFITS`, the roadmap horizon labels, the audit `PLATFORMS`
  list and the dashboard toolkit tiles. It is copy, not data, so it isn't
  exposed.
- **Pages not covered.** These pages have no `/api/mobile` endpoint:
  - `/community/[slug]` and `/community/thread/[id]`. `/community` sends members to Skool.
  - `/u/[handle]`. It is a public page; the data comes from `getPublicLinkPage`.
  - `/admin/import`, which is a file workflow.
  - The Studio sub-tools. They already have JSON GETs (see §3).
  - Boards. They already have JSON GETs (see §3).
