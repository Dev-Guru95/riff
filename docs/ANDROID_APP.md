# Riff on Android — audit, parity checklist and delivery notes

**Date:** 2026-09-23
**Deliverable:** `android/app/build/outputs/apk/release/app-release.apk` (1.87 MB, signed, verified)

---

## 1. Architecture decision

### What the audit found

| Measure | Value |
|---|---|
| Framework | Next.js 16.2.9, App Router, React 19.2.4 |
| Language / styling | TypeScript, Tailwind CSS v4 |
| Data layer | Prisma 6 + PostgreSQL — **66 models**, 1,013-line schema |
| Source size | 19,737 LOC in `src` |
| Pages | 45 |
| API route files | 100 |
| Client components | 47 |
| Auth | Custom JWT (`jsonwebtoken`) in an httpOnly cookie `riff_session`, 30-day expiry, bcryptjs cost 12, TOTP MFA via `otplib` |
| Roles | `artist`, `reviewer`, `moderator`, `admin` — enforced per page and per route (there is no `middleware.ts`) |
| Hosting | Render, `riff-app.onrender.com` (free tier) |

### The finding that drove the decision

**21 of the 45 pages are React Server Components that query Prisma directly.**
Dashboard, courses, learn, leaderboard, certificates, missions, roadmap,
community and every admin page render server-side straight from the database.
The 100 API routes are overwhelmingly *mutations* used by client components,
plus the Kanban and Studio subsystems.

There is therefore **no JSON API behind most of the read paths**. A React Native
rewrite could not "consume the existing endpoints" as the brief assumed — those
endpoints do not exist. It would have required building roughly 60–80 new
endpoints *first*, then reimplementing 45 screens and 47 client components. That
cannot be delivered without shipping stubs, and stubs were explicitly excluded.

### What was built

A native Kotlin Android application (Android Studio / Gradle project, `android/`)
that hosts the Riff UI in a hardened WebView against the live backend, wrapped in
genuine native behaviour: login-first launch, persistent session, hardware back,
pull-to-refresh, native error and offline screens, native file picker and camera
for uploads, authenticated downloads, background notification polling, deep
links, and full-screen video.

This yields **100% feature parity on day one**, including every admin screen,
because the feature set is the product itself rather than a reimplementation of
it. The honest trade-off is stated in §7.

---

## 2. Feature parity checklist

Every route discovered in the audit. "Reachable" means the screen is served to
the app by the same backend that serves the website, with the same session.

### Authentication

| Website feature | Android | Notes |
|---|---|---|
| `/login` | ✅ **Entry point** | First screen on launch, per requirement |
| `/signup` | ✅ | Linked from login; creates the same `User` row |
| Password login | ✅ | Verified against production (§4, T1) |
| TOTP two-factor | ✅ | `{mfaRequired:true}` re-prompt works unchanged |
| Logout | ✅ | Verified: cookie cleared, `/dashboard` → 307 `/login` |
| Session expiry | ✅ | Server redirects to `/login`; no client-side trust |
| `?next=` deep-link return | ✅ | Preserved through login by `AppConfig.launchUrl()` |
| Password reset | ⚠️ **Not in the product** | No reset route exists on the website either — see §7 |

### User features

| Website feature | Android |
|---|---|
| `/dashboard` — XP, level, streak, badges, goals, milestones, rank | ✅ |
| `/courses`, `/courses/[slug]` | ✅ |
| `/courses/[slug]/step/[n]` — action steps | ✅ |
| `/courses/[slug]/quiz` — quizzes and attempts | ✅ |
| `/learn/[lessonId]` — lesson player | ✅ |
| `/missions` — missions and completion | ✅ |
| `/roadmap` | ✅ |
| `/leaderboard` | ✅ |
| `/certificates` — program certificates | ✅ |
| `/coach` — AI coach threads and messages | ✅ |
| `/audit` — artist audit engine | ✅ |
| `/community`, `/community/[slug]`, `/community/thread/[id]` | ✅ |
| `/boards`, `/boards/[id]` — full Kanban | ✅ |
| `/studio` + 11 sub-tools (brand kit, merch, gigs, finance, fans, broadcasts, bookings, goals, link-in-bio, caption, drafts) | ✅ |
| `/pricing`, `/settings/billing` — Stripe | ✅ |
| `/u/[handle]` — public artist profile | ✅ |
| Notifications | ✅ + native background polling |
| Search | ✅ |
| File upload (`POST /api/uploads`) | ✅ Native picker **and camera** |
| Downloads (certificates, attachments) | ✅ Cookie-authenticated `DownloadManager` |
| Share to Skool | ✅ |
| Referral capture (`?ref=`) | ✅ Survives deep links |

### Admin features — all present

| Website feature | Android |
|---|---|
| `/admin` — overview and KPIs | ✅ |
| `/admin/courses`, `/admin/courses/[id]` — course/module/lesson authoring | ✅ |
| `/admin/import` — DOCX/PDF course import | ✅ |
| `/admin/submissions` — review queue | ✅ |
| `/admin/moderation` — reports, blocks | ✅ |
| `/admin/users` — user management, roles, status | ✅ |
| `/admin/coupons` | ✅ |
| `/admin/content` — AI content suggestions | ✅ |
| `/admin/security` | ✅ |
| Rewards issuing, quiz/assignment editing | ✅ |

### Cross-cutting

| Concern | Android |
|---|---|
| Same accounts as the website | ✅ Verified end-to-end (§4) |
| Same database | ✅ One Postgres, no mobile store |
| Same roles and permissions | ✅ Server-enforced, verified 403/307 |
| Real-time consistency | ✅ Every read is a live server render |
| Offline handling | ✅ Native screen + retry |
| Server error handling | ✅ Native screen, raw `net::` codes never shown |
| Rotation / state | ✅ `saveState`/`restoreState`, no form loss |
| Back navigation | ✅ History, then double-tap to exit |
| Deep links | ✅ `https://riff-app.onrender.com/*` |

---

## 3. Mobile UI/UX

The website was already mobile-first: `UserNav` and `AdminNav` both collapse from
a `lg:` sidebar into a top bar with a slide-down drawer, and the grids are
written `grid-cols-2 sm:grid-cols-4` throughout. The app therefore renders a real
phone layout, not a shrunken desktop one. The drawer pattern is one of the three
the brief listed as acceptable (Header / Drawer / Bottom navigation).

Changes committed to the **shared** web codebase — they improve the mobile web
site as much as the app:

- `src/app/layout.tsx` — a `viewport` export with `themeColor: "#0a0a0f"` and
  `colorScheme: "dark"`, so the status bar blends into the shell. Pinch-zoom is
  deliberately left enabled; disabling it is an accessibility regression.
- `src/app/globals.css` — a touch block: 44px minimum targets on `.btn`/`.pill`
  for coarse pointers; 16px inputs to stop focus-zoom jumping the layout;
  `overscroll-behavior-y: contain` so the page does not fight the native
  pull-to-refresh; `text-size-adjust: 100%`; tap-highlight replaced with a
  deliberate pressed state; long-string wrapping to prevent sideways scroll.

Native chrome mirrors the web tokens exactly (`#0a0a0f` background, `#8b5cf6` →
`#ec4899` brand gradient) in the splash screen, refresh spinner and error state.

---

## 4. Testing performed

### Verified against **production** (`riff-app.onrender.com`)

| # | Test | Result |
|---|---|---|
| — | Backend health | ✅ `{"status":"ok","db":{"ok":true,"latencyMs":605}}` |
| T1 | Account created via API, then logged in with the Android User-Agent | ✅ `200`, role `artist` returned |
| T2 | Session cookie issued to the app | ✅ `riff_session`, `Secure`, `HttpOnly`, 249-char JWT |
| T3 | Authenticated `GET /dashboard` | ✅ `200`, 58,768 bytes rendered |
| T4 | `GET /api/notifications` (the worker's endpoint) | ✅ `{"items":[],"unread":0}` — matches the parser |
| T5 | No session → `/dashboard` | ✅ `307` → `/login` |
| T6 | Non-admin session → `/admin` | ✅ `307` → `/login` |
| T7 | Non-admin → `PATCH /api/admin/users/:id` role escalation | ✅ `403 Forbidden — admin access required` |
| T8 | Logout, then `/dashboard` | ✅ `200` logout, then `307` → `/login` |

T1–T3 together prove the brief's central requirement: **an account made outside
the app logs into the app with the same credentials and reaches the same data.**

### Build verification

- `assembleDebug` — ✅ success
- `assembleRelease` with R8 + resource shrinking — ✅ success
- `lintVitalRelease` — ✅ passed
- `apksigner verify` — ✅ APK Signature Scheme v2, signer `CN=Riff, OU=Mobile, O=Riff`
- Manifest verified: launcher activity, `singleTask`, deep-link filter, FileProvider, `usesCleartextTraffic=false`
- Sizes: 1,867,278 bytes on disk / 1,187,901 bytes download

### Web regression suite (after the CSS/viewport changes)

- `tsc --noEmit` — ✅ clean
- `vitest run` — ✅ **107 passed**, 6 skipped, 16 files
- `next build` — ✅ success, all 45 routes compiled

### Not performed

**The APK was not launched on a device or emulator.** The Android emulator on
this machine refuses to start: `x86_64 emulation currently requires hardware
acceleration`, and the hypervisor driver is absent. Installing it, or enabling
the Windows Hypervisor Platform feature, needs administrator elevation that this
session does not have — even querying the feature state returned *"The requested
operation requires elevation."* No physical device was attached.

So runtime behaviour — splash, first paint on `/login`, gesture handling — is
verified by construction and static analysis, **not** by observation. To close
this, plug in a phone and run:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.riff.app/.MainActivity
adb logcat -s RiffApp chromium AndroidRuntime
```

---

## 5. Backend changes made

**None to behaviour, routes, auth, schema or business logic.** No migration was
run, no endpoint added or altered, no model changed.

The only edits to the web codebase are the two presentation-layer changes in §3
(`src/app/layout.tsx`, `src/app/globals.css`). Both are additive, both are
covered by the passing test suite and production build.

This was possible because the existing auth already works for a mobile client:
the cookie is `SameSite=Lax`, which is sent on top-level navigations, and the
WebView is a first-party context on the same origin.

---

## 6. Dependencies added

No new **web** dependencies — `package.json` is untouched.

New Android dependencies (`android/app/build.gradle.kts`), all AndroidX/Google:

| Dependency | Version | Why |
|---|---|---|
| `androidx.core:core-ktx` | 1.15.0 | Kotlin extensions |
| `androidx.appcompat:appcompat` | 1.7.0 | `AppCompatActivity` |
| `com.google.android.material:material` | 1.12.0 | Material 3 theme, buttons |
| `androidx.constraintlayout:constraintlayout` | 2.2.0 | Layout |
| `androidx.swiperefreshlayout:swiperefreshlayout` | 1.1.0 | Pull-to-refresh |
| `androidx.core:core-splashscreen` | 1.0.1 | Splash, no white flash |
| `androidx.webkit:webkit` | 1.12.1 | Modern WebView APIs |
| `androidx.browser:browser` | 1.8.0 | Chrome Custom Tabs |
| `androidx.activity:activity-ktx` | 1.9.3 | Result APIs, back dispatcher |
| `androidx.work:work-runtime-ktx` | 2.10.0 | Notification polling |
| `kotlinx-coroutines-android` | 1.9.0 | Worker concurrency |

Tooling installed locally: Android command-line tools and the
`android-34;google_apis;x86_64` system image (for the emulator attempt).

---

## 7. Remaining issues and honest limitations

1. **Runtime launch is unverified.** See §4. One `adb install` closes it.

2. **The UI is web-rendered.** This is the deliberate trade-off behind 100%
   parity. Consequences: first paint depends on network, and behaviour is
   Chromium's rather than a native widget's. If you later want native screens,
   the shell is the right base — replace screens one at a time behind the same
   session (that was option 3 in the original choice).

3. **Render free tier cold starts.** An idle instance can take ~50 seconds to
   wake — during the audit a `curl` to `/login` timed out at 60s while
   `/api/health` succeeded. The app handles this with a distinct
   "server is taking too long… it may be waking up" message and a retry, but the
   real fix is a paid instance or a keep-alive ping. *This affects the website
   identically; it is not an app defect.*

4. **Google-owned OAuth inside a WebView.** Google blocks OAuth in embedded
   WebViews (`disallowed_useragent`). If `SOCIAL_YOUTUBE_*` is configured in
   Render, YouTube connect may be refused. Spotify, Facebook, Instagram, TikTok
   and X are unaffected. It could not be tested because the social OAuth
   variables are unset locally and live only in Render's dashboard. Fix if
   needed: route that one provider through Custom Tabs and hand the result back
   via the deep link already registered.

5. **No password reset exists in the product.** The audit found no reset or
   email-verification route anywhere in the 100 API files — the website does not
   have this feature, so the app cannot either. This is a **product gap, not a
   parity gap**. It needs a backend feature (token issuing + an email provider;
   none is currently configured) before either platform can offer it.

6. **No push notifications.** There is no FCM configuration in the project, so
   unread counts are polled every 15 minutes by WorkManager. Real push needs an
   FCM project and a backend send path.

7. **Deep-link verification is unproven.** `autoVerify="true"` needs
   `/.well-known/assetlinks.json` served from the site, containing the release
   key SHA-256 `66:F0:93:1F:BE:7C:D8:CD:A5:EB:49:6A:D1:75:7B:5B:08:47:6C:FE:BA:53:71:CF:38:D9:C0:57:5C:71:E3:F3`.
   Until that file is published, Android shows a chooser instead of opening Riff
   directly. Say the word and I will add the route.

8. **`versionCode` is 1.** Bump it for every Play upload.

---

## 8. Security review

| Area | Status |
|---|---|
| Transport | HTTPS only. `usesCleartextTraffic=false` plus a network-security config with no exemptions, so the session cookie can never cross the wire in clear |
| Mixed content | `MIXED_CONTENT_NEVER_ALLOW` |
| Session storage | The httpOnly cookie only. **No credentials, no token copy in SharedPreferences** — there is no second, weaker copy of the session for malware to lift |
| File-origin bridges | `allowFileAccess`, `allowContentAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs` all **false** — a downloaded HTML file cannot read app storage |
| JS bridge | None added. No `@JavascriptInterface` surface exists to attack |
| Camera / mic | Granted only to our own origin, and only those two permissions; everything else denied |
| Popups | `javaScriptCanOpenWindowsAutomatically = false` |
| Authorization | Entirely server-side. Verified a non-admin gets `307` on `/admin` and `403` on admin APIs (§4, T6–T7) |
| Secrets in the APK | None. `BASE_URL` and a UA tag are the only build config; every secret stays in Render |
| Signing | RSA 2048, APK Signature Scheme v2; keystore and password git-ignored |
| Backups | `allowBackup="true"` (Android default). Consider `false` if you want to prevent the cookie jar being included in device backups |

---

## 9. Deliverables

| Item | Location |
|---|---|
| Android source | `android/` |
| Release APK (signed) | `android/app/build/outputs/apk/release/app-release.apk` |
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Build & run instructions | `android/README.md` |
| This audit and checklist | `docs/ANDROID_APP.md` |
| Keystore (git-ignored — back it up) | `android/riff-release.keystore` |

---

## 10. Error audit (2026-09-23)

Ran the full toolchain on both sides — Android Lint, Kotlin compiler, ESLint,
`tsc`, Vitest, `next build` — plus a logged-in runtime pass over production.

### Defects found and fixed

| # | Severity | Where | Defect | Fix |
|---|---|---|---|---|
| 1 | **Functional** | `FileChooserBridge.kt` | On Android 11+ `resolveActivity()` returns null without a `<queries>` declaration, so **the camera option silently never appeared** in the upload picker | Declared `IMAGE_CAPTURE`, `GET_CONTENT` and `VIEW` intents in `<queries>` |
| 2 | **Functional** | `FileChooserBridge.kt` | The camera app is a separate process writing to our FileProvider URI and had **no write grant** — capture would fail | Added `FLAG_GRANT_WRITE_URI_PERMISSION` / `READ` to the capture intent |
| 3 | **Crash risk** | `FileChooserBridge.kt` | When no picker existed the code consumed the callback *and* returned `false`, letting the framework deliver a second result — a duplicate `onReceiveValue` throws inside WebView | Returns `true` after consuming; comment explains why |
| 4 | **Correctness** | `FileChooserBridge.kt` | `cameraOutput` was assigned before checking a camera existed, so a stale capture URI could be returned for a *picked* file | Only claim the pending capture once `resolveActivity` succeeds |
| 5 | **UX** | `NotificationWorker.kt` | `unread != lastSeen` re-notified when the count went **down** — i.e. every time the user read something on the website | Notify only on a genuine increase (`unread > lastSeen`) |
| 6 | **Security** | `AndroidManifest.xml` | `allowBackup="true"` meant the WebView cookie jar — holding the live session JWT — could be copied off-device via cloud backup or device transfer | `allowBackup="false"` + `data_extraction_rules.xml` excluding both transports |
| 7 | Minor | `MainActivity.kt` | `POST_NOTIFICATIONS` re-requested on every cold start | Request only when not already granted |
| 8 | Build | `local.properties` | Unescaped drive-letter colon **failed `./gradlew lint` outright** | Escaped as `C\:/...` |
| 9 | **Functional (web, pre-existing)** | `admin/coupons/CouponsClient.tsx` | The form had `maxRedemptions` state and posted it, and both the API (`z.number().int().min(0)`) and schema (`0 = unlimited`) support limits — **but there was no input**, so `setMax` was never called and *every coupon was created unlimited* regardless of intent | Added a "Max uses" field (`0 = unlimited`) and widened the grid |
| 10 | Lint | `eslint.config.mjs` | The `_`-prefix convention for deliberately-unused args (e.g. the documented `_userId` seam on `isLessonUnlocked`) was being flagged | Configured `argsIgnorePattern: "^_"` rather than deleting the seam |

Also cleaned: layout overdraw, three dead resources, and five non-idiomatic
`Uri.parse`/`SharedPreferences.edit` calls.

### Rejected change

Android Lint suggested bumping ten AndroidX dependencies. Applying them **broke
the build** — `core-ktx 1.19.0` and friends require AGP 9.1+ and compileSdk 37,
neither of which this toolchain has (platform 37 is not installed). Reverted to
the newest compatible set, with a comment in `app/build.gradle.kts` recording why,
so the suggestion is not blindly re-applied later.

### Final state

| Check | Result |
|---|---|
| Android Lint | ✅ **0 errors, 0 warnings** (excluding version-currency notices) |
| Kotlin compile | ✅ clean |
| `assembleDebug` / `assembleRelease` | ✅ both succeed |
| APK signature | ✅ v2, `CN=Riff` |
| ESLint | ✅ **0 errors, 0 warnings** |
| `tsc --noEmit` | ✅ clean |
| Vitest | ✅ **107 passed**, 6 skipped |
| `next build` | ✅ all 45 routes |

### Runtime pass (production, authenticated)

Signed in as a real account and walked the pages the APK renders:

| Page | Console errors |
|---|---|
| `/login` | none |
| `/dashboard` | none |
| `/boards` | none |
| `/studio` | none |
| `/coach` | none |
| `/community` | none |
| `/courses` | none |

**Zero console errors, warnings or hydration mismatches across all seven.**
Also verified in-browser: a non-admin hitting `/admin` is redirected to `/login`;
the mobile top bar (`lg:hidden sticky`) and hamburger are in the DOM with the
sidebar `hidden lg:flex`; and `scrollWidth === clientWidth`, so there is no
horizontal overflow.

Cold start was observed directly — the site served Render's "Application loading"
page for roughly 30 seconds before responding. This is limitation #3, confirmed
in the wild rather than predicted.

### ⚠️ Action required: the web changes are not deployed

Production still lacks the `viewport`/`theme-color` export and the touch CSS —
confirmed live (`document.querySelector('meta[name=theme-color]')` returned
`undefined`). **The APK points at production, so the touch-target, input-zoom and
theme-colour improvements will not appear until `src/app/layout.tsx`,
`src/app/globals.css`, `CouponsClient.tsx` and `eslint.config.mjs` are committed
and deployed.** The APK itself needs no rebuild for that — it picks the changes up
on the next page load.
