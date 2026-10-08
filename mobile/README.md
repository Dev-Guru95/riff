# Riff — native mobile app (Expo / React Native)

The native iOS + Android version of Riff. It is **not** a WebView and has **no
backend of its own**: it talks to the same Next.js backend, PostgreSQL database
and user accounts as the website.

```
Website (Next.js pages) ─┐
                         ├─► Next.js API routes (src/app/api/**) ─► PostgreSQL
Mobile app (this) ───────┘
```

- An account created on the web logs in here, and vice versa: both call
  `POST /api/auth/login` / `POST /api/auth/signup` against the same `User` table.
- The app sends `x-riff-client: native`, so login/signup return the same 30-day
  JWT the web keeps in its `riff_session` cookie. The app stores it in the OS
  keystore (`expo-secure-store`) and sends it as `Authorization: Bearer <jwt>`.
- Every admin permission is enforced by the server (`requireAdmin` re-reads the
  role from the database). The app only hides UI the server would refuse anyway.
- API contract: `docs/MOBILE_API.md` in the repo root. Response types for
  `/api/mobile/*` are copied verbatim into `src/types/api.ts` from the web repo's
  `src/lib/mobile/types.ts`. Re-copy when that file changes.

## Running it

```bash
cd mobile
npm install
npx expo start            # scan with a development build, or press a for Android
```

Backend selection (`src/config/env.ts`):

| `EXPO_PUBLIC_APP_ENV` | Default backend |
|---|---|
| `development` (default) | https://riff-app.onrender.com |
| `testing` | https://riff-app.onrender.com |
| `production` | https://riff.soundrig.io |

Override with `EXPO_PUBLIC_API_URL`, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000`
to hit a local `pnpm dev` from a phone on the same Wi-Fi. Copy `.env.example`
to `.env.local`. Never put secrets in `EXPO_PUBLIC_*`: they are bundled into the app.

Checks: `npx tsc --noEmit` and `npx eslint src`.

## Builds (EAS)

`eas.json` has `development` (dev client APK), `preview` (installable APK on the
testing backend) and `production` (AAB / iOS on riff.soundrig.io) profiles.

```bash
npx eas-cli@latest build -p android --profile preview      # APK
npx eas-cli@latest build -p android --profile production   # AAB for Play
npx eas-cli@latest build -p ios --profile production
```

The Android `package` is `com.riff.app`, the same as the old WebView app in
`../android/`. Signed with the same upload key, it installs as an update over it.

## Code layout

```
src/
  app/                 Expo Router routes (files = screens). Paths mirror the website.
    (auth)/            login, signup (shown only when signed out)
    (app)/(tabs)/      Home, Courses, Coach, Projects, More
    (app)/...          stack screens: /courses/[slug], /learn/[id], /boards/[id], /studio/*, /admin/* …
  api/                 client.ts (the only place fetch is called), errors.ts, queryClient.ts
  auth/                AuthProvider: secure token storage, session restore, 401 handling
  components/ui/       design-system primitives ported from the web
  components/          shared feature components (Markdown, ShareToSkool, …)
  hooks/               useApiQuery / useApiMutation / useInvalidate, notifications
  lib/                 constants.ts (copied from web), links.ts (web path → app route)
  theme/tokens.ts      colours, radius, fonts, type scale from web globals.css
  types/api.ts         response types (copied from web)
```

## Conventions for screens

- **Data.** Use `useApiQuery<T>(path, query?)` for reads and `useApiMutation({ invalidates, success })`
  for writes. Never call `fetch` in a screen. Query keys are API paths, so
  invalidate by path after a write. File uploads use `upload()` from `@/api/client`
  (multipart, field `file`).
- **States.** Wrap data in `<QueryView query={q}>{(data) => …}</QueryView>`. It renders
  the skeleton, the error with a retry button, and the offline message. Pass `isEmpty`/`empty` for
  empty lists. Screens use `<Screen onRefresh={q.refetch}>` for pull-to-refresh,
  safe areas and keyboard avoidance.
- **Lists.** For long or paginated lists use `FlashList` from `@shopify/flash-list`, not
  ScrollView + map.
- **UI.** Use only `@/components/ui` and tokens from `@/theme/tokens`: no ad-hoc hex
  colours, no other fonts. Touch targets are at least 44pt. Desktop tables become cards or rows.
  Multi-column layouts become a single column. Confirm destructive actions with `Alert.alert`.
  Report results with `useToast()`.
- **Navigation.** The route path equals the website path. Set titles with
  `<Stack.Screen options={{ title }} />` inside the screen. Use `openLink()` for
  links that come from server data.
- **No fake data.** Every number on screen comes from the API.
