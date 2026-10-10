// Links between the app, the website and third parties.
//
// The app's routes deliberately mirror the website's paths (/courses/[slug],
// /learn/[id], /boards/[id], /studio/…, /admin/…), so a path the backend hands
// out — a notification link, a share URL — opens the native screen directly.

import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { API_URL, absoluteUrl } from "@/config/env";

/** Web paths that exist natively in the app. */
const NATIVE_PREFIXES = [
  "/courses",
  "/learn/",
  "/coach",
  "/missions",
  "/studio",
  "/boards",
  "/audit",
  "/roadmap",
  "/community",
  "/leaderboard",
  "/certificates",
  "/pricing",
  "/settings",
  "/notifications",
  "/admin",
];

/** Map a website path to an app route, or null when the app has no such screen. */
export function routeForWebPath(path: string): string | null {
  const clean = path.replace(API_URL, "").split("#")[0] ?? "";
  const pathname = clean.split("?")[0] ?? "";
  if (pathname === "" || pathname === "/" || pathname === "/dashboard") return "/";
  // The web retired its in-app forums: /community/<forum> and
  // /community/thread/<id> redirect to the /community gateway.
  if (pathname.startsWith("/community/")) return "/community";
  // "/learn/" only matches with an id after it; the others match the page and below.
  const native = NATIVE_PREFIXES.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) && pathname.length > p.length : pathname === p || pathname.startsWith(`${p}/`),
  );
  return native ? clean : null;
}

/**
 * Open a link from server data: native screen when the app has one, the in-app
 * browser for anything else on the web origin or the internet.
 */
export async function openLink(pathOrUrl: string) {
  const isExternal = /^https?:\/\//i.test(pathOrUrl) && !pathOrUrl.startsWith(API_URL);
  if (!isExternal) {
    const route = routeForWebPath(pathOrUrl);
    if (route) {
      router.push(route as Href);
      return;
    }
  }
  await openInBrowser(absoluteUrl(pathOrUrl));
}

/** In-app browser tab (Chrome Custom Tab / SFSafariViewController). */
export function openInBrowser(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    toolbarColor: "#0a0a0f",
    controlsColor: "#8b5cf6",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
