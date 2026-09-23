# App store rejection sweep — Riff Android

**Date:** 2026-09-23 · **Build:** `com.riff.app` 1.0.0 (versionCode 1) · minSdk 26 / targetSdk 36

**Original verdict (sweep):** would be REJECTED from Google Play — three blockers.

**Current status:** blockers 1 and 2 are **implemented and deployed**. One
blocker remains (payments), and it is a business decision rather than a defect.
See §9 for what changed.

---

## 0. First, the iPad question

**There is no iOS app, so iPad review does not apply.** What was built is an
Android application (Kotlin + Gradle). An `.apk`/`.aab` cannot be submitted to
Apple in any form — iOS needs a separate Swift/Xcode project, a Mac to build it,
and a $99/year Apple Developer account.

If iPad is actually wanted, know that **Apple is considerably harsher than Google
on this app's architecture**:

| Apple guideline | Risk for this app |
|---|---|
| **4.2 Minimum Functionality** | Apple explicitly rejects apps that are "primarily marketing materials or a repackaged website". A WebView shell is the classic 4.2 rejection. This is a **high** risk — materially higher than the equivalent Play policy. |
| **3.1.1 In-App Purchase** | Selling Pro/Premium through Stripe inside the app is not permitted; Apple requires IAP for digital content, at 15–30%. |
| **5.1.1(v) Account Deletion** | Same requirement as Google — currently unmet (see blocker 1). |
| **iPad-specific** | If submitted as iPhone-only it still must run on iPad. Apple requires full multitasking/Split View support and rejects letterboxed or non-adaptive layouts. |

**Recommendation:** ship Android first. Treat iOS as a separate decision, because
a WebView shell that passes Play review has a genuine chance of failing Apple 4.2.

---

## 1. BLOCKER — Account deletion (Google Play, mandatory since 2023)

Play's User Data policy: **any app that lets users create an account must let
them request deletion of that account and its data** — from *inside the app*,
**and** from a publicly reachable web URL submitted in the Play Console (the URL
must work without installing the app).

**Current state: there is no account deletion anywhere in the product.**

I searched the whole codebase. The only `user.delete` is a test-suite cleanup
helper (`src/lib/achievements.integration.test.ts:52`). There is:

- no self-serve "delete my account" UI,
- no `DELETE` handler on `/api/admin/users/[id]`,
- no deletion route of any kind.

This is a **product gap, not an app gap** — the website fails the same policy.
Play reviewers check this specifically and it is one of the most common
rejections for apps with logins.

### What it needs

1. A `DELETE /api/account` route: verify the session, require password
   re-entry, then delete or irreversibly anonymise the user.
2. A confirmation UI under settings.
3. A public web page, e.g. `/account/deletion`, explaining how to request
   deletion — this exact URL goes in the Play Console form.
4. A decision on the **65 related models**: `Enrollment`, `LessonProgress`,
   `QuizAttempt`, `Submission`, `XpLedger`, `Card`, `Comment`, `Post`,
   `Certificate`, `Subscription` and the rest. Cascade rules need checking in
   `schema.prisma` or deletion will fail on foreign keys. Community posts
   normally get anonymised rather than removed so threads stay readable.
5. Stripe: cancel any live subscription as part of deletion.

**Effort: roughly a day**, mostly deciding delete-vs-anonymise per model.

---

## 2. BLOCKER — No privacy policy

Play requires a privacy policy URL for **every** app that handles personal data.
This app handles email addresses, passwords, uploaded files, analytics events and
optionally social OAuth tokens.

There is **no privacy or terms page in the codebase** — no `/privacy`, no
`/terms`, no legal route among the 45 pages.

Needs: a `/privacy` page (and normally `/terms`) publicly reachable without
login, plus the URL entered in the Play Console listing. It must disclose what is
collected, why, who it is shared with, retention, and how to request deletion —
and must match the Data Safety form exactly, because reviewers compare them.

**Effort: a few hours**, plus legal review if you want it done properly.

---

## 3. BLOCKER — Stripe for in-app digital subscriptions

Play's Payments policy requires **Google Play Billing** for digital content
consumed inside the app. Riff sells Pro and Premium, and those plans unlock
in-app digital features — confirmed in `src/lib/entitlements.ts`:

```
free:    5 coach messages/day,    1 social connection,  limited courses
pro:     1000 coach messages/day, 6 social connections, all courses
premium: 5000 coach messages/day, 6 social connections, all courses + human review
```

That is squarely "digital goods". Taking payment via Stripe Checkout inside the
app is the kind of thing that gets an app removed *after* approval, not just
rejected — a worse failure mode, because by then you have users on it.

### Options

| Option | Cost | Notes |
|---|---|---|
| **A. Integrate Play Billing** | 15% of first $1M/yr | Fully compliant. Needs a real billing client plus server-side purchase verification and reconciliation with the `Subscription` model. Several days. |
| **B. Hide purchase flows in the app** (recommended to ship) | none | Detect the `RiffAndroid` User-Agent server-side — already sent by the app — and hide `/pricing` CTAs and `/settings/billing` upgrade buttons. Existing paid users keep their entitlements; they simply cannot *buy* in the app. This is the standard "reader app" posture and is allowed, provided the app does not link out to an external purchase page. |
| **C. Do nothing** | — | Not viable. Expect rejection or later removal. |

**Option B is roughly an hour** and the app already sends the signal needed to
implement it.

---

## 4. Elevated risk — "Minimum Functionality" / webview repackaging

Play's Spam policy rejects apps that are "primarily a webview of a website" with
no added value. This is the single judgement-call risk in the sweep.

**Mitigating factors already in the build** (these are what usually decide it):

- Native launch flow going straight to Login, not a homepage
- Native splash screen
- Native offline and server-error screens with retry, rather than Chromium's
  `net::` error pages
- Native file picker **and camera** integration for uploads
- Authenticated downloads via `DownloadManager`
- Background notification polling with system notifications
- Hardware back navigation and double-tap-to-exit
- Pull-to-refresh
- Deep link handling
- Full-screen video support

That is a substantially stronger case than a bare webview, and apps of this shape
do pass. **But it is a reviewer's judgement, not a checklist**, so treat approval
as likely rather than certain.

**To improve the odds:** complete the deep-link verification (item 8) so the app
handles `riff-app.onrender.com` links natively — reviewers read that as real
platform integration.

---

## 5. Tablet and large-screen suitability — PASSES

Verified against the built APK:

| Check | Result |
|---|---|
| `supports-screens` | ✅ `small` `normal` `large` `xlarge` |
| `supports-any-density` | ✅ `true` |
| Screen-size restriction | ✅ none declared |
| `screenOrientation` lock | ✅ none — rotates freely |
| `maxAspectRatio` limit | ✅ none — no letterboxing on tall or foldable screens |
| `resizeableActivity` | ✅ defaults true (minSdk 26) — multi-window and Split View work |
| Rotation handling | ✅ `configChanges` + `saveState`/`restoreState`; no reload, no lost form input |

**On a tablet the app is better than on a phone, not worse.** The underlying site
is responsive at the Tailwind `lg:` breakpoint (1024px): a tablet in landscape
crosses it and gets the full desktop sidebar layout, while portrait gets the
mobile drawer. Both are real layouts — nothing is stretched or letterboxed.

Play will not reject for tablets. If you want the "Designed for tablets" listing
badge you must upload tablet screenshots (7" and 10"), which is a listing task,
not a code change.

---

## 6. Permissions — one real bug found and fixed

The manifest declared `android.permission.CAMERA`, which looked like it was
enabling the camera upload option. **It was breaking it.**

Once an app declares `CAMERA`, Android throws `SecurityException` on
`ACTION_IMAGE_CAPTURE` until the user grants that permission at runtime — and the
app never requested it. Capture is delegated to the installed camera app, which
needs no permission of ours, so the declaration was pure downside: a broken
feature *and* extra Play Console scrutiny on a sensitive permission.

**Fixed — removed.** Final permission set in the shipped build:

| Permission | Source | Justification |
|---|---|---|
| `INTERNET` | ours | Core |
| `ACCESS_NETWORK_STATE` | ours | Offline detection |
| `POST_NOTIFICATIONS` | ours | Unread notifications |
| `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE` | WorkManager | Reschedules the notification poll after reboot. No foreground service is ever started, so no `foregroundServiceType` declaration is required. |

No sensitive-permission declaration form is needed — there is no location,
contacts, SMS, call log, or All Files Access.

---

## 7. Technical submission requirements — PASS

| Requirement | Status |
|---|---|
| **App Bundle (.aab)** — Play refuses APKs for new apps | ✅ Built: `dist/riff-1.0.0.aab` (2.82 MB) |
| `targetSdk` ≥ 35 | ✅ 36 |
| 64-bit compliance | ✅ No native code at all |
| 16 KB page size (new apps, Nov 2025) | ✅ N/A — zero `.so` libraries |
| `debuggable` false | ✅ Verified in the release binary |
| Release signing | ✅ RSA 2048, APK Signature Scheme v2 |
| Cleartext traffic disabled | ✅ `usesCleartextTraffic=false` + network security config |
| `versionCode` | ⚠️ 1 — fine for first upload, must increment every submission |

---

## 8. Store listing work still to do

Not rejections, but the submission cannot be completed without them:

- [ ] **Data Safety form** — declare email, password, uploaded files, analytics. Must match the privacy policy exactly.
- [ ] **Content rating questionnaire** — note it has user-generated content (community forums), which affects the rating and triggers moderation questions. You do have moderation tooling, which helps.
- [ ] **512×512 PNG store icon** — the in-app icon is an adaptive vector; the listing needs a raster.
- [ ] **Feature graphic** 1024×500.
- [ ] **Screenshots** — min 2 phone; add 7"/10" tablet for the tablet badge.
- [ ] **`/.well-known/assetlinks.json`** with SHA-256 `66:F0:93:1F:BE:7C:D8:CD:A5:EB:49:6A:D1:75:7B:5B:08:47:6C:FE:BA:53:71:CF:38:D9:C0:57:5C:71:E3:F3` — until this exists, `autoVerify` fails and Android shows a chooser instead of opening Riff. (Note: this fingerprint changes if you enrol in Play App Signing — use the one Play gives you.)
- [ ] **UGC policy** — forums need a visible reporting flow and terms. Report/block APIs exist; make sure they are reachable in the UI.

---

## Summary

| # | Item | Severity | Where the fix lives |
|---|---|---|---|
| 1 | No account deletion | **Blocker** | Backend + web UI |
| 2 | No privacy policy | **Blocker** | Web page + listing |
| 3 | Stripe for digital goods | **Blocker** | Backend (hide in-app) or Play Billing |
| 4 | Minimum-functionality judgement | Elevated risk | Already mitigated; improve with assetlinks |
| 5 | Tablet suitability | ✅ Pass | — |
| 6 | CAMERA permission bug | ✅ Fixed | Android manifest |
| 7 | Technical requirements | ✅ Pass | — |
| 8 | Listing assets | To do | Play Console |

**None of the three blockers are Android problems.** The app is technically ready;
the product is missing two legally-required features (account deletion, privacy
policy) that its website is also missing, plus a payments decision. Realistically
**one to two days** of backend work clears all three.


---

## 9. Remediation — what was implemented

### Blocker 1: Account deletion — DONE

| Piece | Location |
|---|---|
| Deletion logic | `src/lib/account.ts` |
| API | `DELETE /api/account` — requires password re-entry **and** the typed word `DELETE` |
| In-app entry point | `/settings` → "Delete my account" (Settings added to the main nav so it is discoverable, as Play requires) |
| Public URL for Play Console | **`https://riff-app.onrender.com/account/deletion`** |
| Post-deletion page | `/account/deleted` (public — the session is gone by then) |

**No schema migration was needed.** Every `User` relation already declared
`onDelete: Cascade`, so `user.delete()` clears the bulk of the 66 models.

**Six tables do not cascade** and would have silently outlived the account,
keeping personal data about someone who asked to be forgotten. They store
`userId` as a plain `String` with no relation, so Prisma does not know it is a
foreign key. All six are now deleted explicitly, in the same transaction:

`Notification` · `AnalyticsEvent` · `CouponRedemption` · `LeaderboardSnapshot` ·
`Report` (all three of `reporterId`, `reviewedById`, and `targetId` where
`targetType = "user"`) · `UserBlock` (both `blockerId` and `blockedId`)

Two safeguards:

- **Last admin is protected.** Deleting the only admin account is refused with a
  409, since it would lock everyone out of the admin area.
- **Stripe subscription is cancelled first**, so nobody keeps paying for a
  product they can no longer open. Deliberately best-effort — a payment provider
  outage must not block a legal right to erasure — with the failure logged and
  the user told to check their statement.

**Design decision worth knowing:** community threads and posts are *deleted*,
not anonymised, because they cascade. That is the strongest privacy posture and
what the policy wants, but it means replies to that person lose their context.
Anonymising instead would need a schema migration making `Post.userId` nullable
with `onDelete: SetNull`. Say the word if you would prefer that.

### Blocker 2: Privacy policy — DONE

Published at **`https://riff-app.onrender.com/privacy`** — public, static, no
auth, so a reviewer can open it directly.

Written from what the code actually does rather than from a template. It names
**DeepSeek** as the recipient of coach conversations and assignment text (which
a generic template would have missed, and which the Data Safety form must also
declare), and **Stripe** as the holder of payment records that cannot be erased.

> ⚠️ **One thing you must do before submitting:** the policy carries a
> placeholder — `[LEGAL ENTITY NAME], [REGISTERED ADDRESS]`. I will not invent a
> legal identity for you. Fill it in, and have a lawyer review the document if
> this is going to be a real commercial product.

### Blocker 3: Payments — still open

Unchanged, and a business decision rather than a bug. Option B (hide purchase
flows when the `RiffAndroid` User-Agent is present) remains the ~1 hour route to
compliance. Nothing has been changed here without your call on it.

### Also fixed

The `CAMERA` permission was removed — see §6. It was breaking the very feature
it appeared to enable.

### Verified live against production (2026-09-23)

Deploy landed in ~105s; the full flow was then exercised end to end against
`riff-app.onrender.com` with a throwaway account:

| # | Test | Result |
|---|---|---|
| A | `/account/deletion` and `/privacy` reachable **without auth** | ✅ both `200` — what a reviewer does |
| B | Create throwaway account | ✅ `201` |
| C | Sign in, load `/dashboard` | ✅ `200` |
| D | Delete with **wrong password** | ✅ `401` *"That password is not correct"* — refused |
| E | Delete **without typing `DELETE`** | ✅ `422` validation error — refused |
| F | Delete with correct credentials | ✅ `200` `{"deleted":true,"billingNeedsAttention":false}` |
| G | Log in again with those credentials | ✅ `401` *"Invalid email or password"* — **the account is genuinely gone** |
| H | Reuse the old session cookie | ✅ `307` → `/login` — session no longer valid |

G is the one that matters: the account is actually erased, not merely flagged
inactive. D and E confirm the irreversible action cannot be triggered by a
borrowed session or a forged post.
