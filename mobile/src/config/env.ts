// Which backend the app talks to. There is no mobile backend: every environment
// points at a deployment of the same Next.js app the website runs on.
//
// Set per build via EAS profiles (eas.json → env) or a local .env:
//   EXPO_PUBLIC_APP_ENV   development | testing | production
//   EXPO_PUBLIC_API_URL   override the base URL (e.g. http://192.168.1.20:3000 for a local `pnpm dev`)
//
// EXPO_PUBLIC_* values are inlined into the bundle and are readable by anyone who
// unpacks the app, so only public URLs belong here — never secrets.

export type AppEnv = "development" | "testing" | "production";

const DEFAULT_URLS: Record<AppEnv, string> = {
  development: "https://riff-app.onrender.com",
  testing: "https://riff-app.onrender.com",
  production: "https://riff.soundrig.io",
};

const rawEnv = process.env.EXPO_PUBLIC_APP_ENV;
export const APP_ENV: AppEnv =
  rawEnv === "production" || rawEnv === "testing" ? rawEnv : "development";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URLS[APP_ENV]).replace(/\/+$/, "");

/** Absolute URL for a backend path, or an already-absolute URL (e.g. an upload). */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export const REQUEST_TIMEOUT_MS = 20_000;
