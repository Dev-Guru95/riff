// Web <-> mobile parity check. Run against a LOCAL or throwaway backend only:
// it creates test users, a board and a studio goal, and needs the seeded demo
// admin (SEED_DEMO_USERS=true). Usage:
//   node scripts/mobile-parity-check.mjs http://localhost:3000
if (!/localhost|127\.0\.0\.1/.test(process.argv[2] ?? "http://localhost:3123")) {
  console.error("Refusing to run against a non-local backend: this script writes test data.");
  process.exit(2);
}
const BASE = process.argv[2] ?? "http://localhost:3123";
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); }
};

async function req(path, { method = "GET", body, cookie, bearer, native } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (native) headers["x-riff-client"] = "native";
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  let json = null;
  try { json = await res.json(); } catch {}
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = /riff_session=([^;]+)/.exec(setCookie);
  return { status: res.status, json, cookie: m ? `riff_session=${m[1]}` : null };
}

const stamp = Date.now();
const webEmail = `web${stamp}@example.com`;
const mobEmail = `mob${stamp}@example.com`;
const PW = "correct-horse-1";

console.log("\n1. Web signup → mobile login (same account)");
const ws = await req("/api/auth/signup", { method: "POST", body: { email: webEmail, password: PW, stageName: "WebArtist" } });
check("web signup 201 with cookie", ws.status === 201 && !!ws.cookie, JSON.stringify(ws));
check("web signup body has no token", ws.json && !("token" in ws.json));
const ml = await req("/api/auth/login", { method: "POST", native: true, body: { email: webEmail, password: PW } });
check("mobile login 200 with token", ml.status === 200 && typeof ml.json?.token === "string", JSON.stringify(ml.json));
const me1 = await req("/api/mobile/me", { bearer: ml.json?.token });
check("mobile /me is the web-created user", me1.status === 200 && me1.json?.user?.id === ws.json?.id && me1.json?.profile?.stageName === "WebArtist", JSON.stringify(me1.json));
check("/me exposes no secrets", me1.json && !JSON.stringify(me1.json).match(/passwordHash|mfaSecret/));

console.log("\n2. Mobile signup → web login (same account)");
const msu = await req("/api/auth/signup", { method: "POST", native: true, body: { email: mobEmail, password: PW, stageName: "MobileArtist" } });
check("mobile signup 201 with token", msu.status === 201 && typeof msu.json?.token === "string", JSON.stringify(msu.json));
const wl = await req("/api/auth/login", { method: "POST", body: { email: mobEmail, password: PW } });
check("web login 200 with cookie, no token", wl.status === 200 && !!wl.cookie && !("token" in (wl.json ?? {})));
const me2 = await req("/api/mobile/me", { cookie: wl.cookie });
check("web session sees the mobile-created user", me2.json?.user?.id === msu.json?.id && me2.json?.profile?.stageName === "MobileArtist");

console.log("\n3. Auth failures");
check("wrong password → 401", (await req("/api/auth/login", { method: "POST", native: true, body: { email: webEmail, password: "nope-nope" } })).status === 401);
check("no session → 401", (await req("/api/mobile/me")).status === 401);
check("forged bearer → 401", (await req("/api/mobile/me", { bearer: "abc.def.ghi" })).status === 401);
check("duplicate signup → 409", (await req("/api/auth/signup", { method: "POST", native: true, body: { email: webEmail, password: PW } })).status === 409);

console.log("\n4. Data sync both ways");
const tokA = ml.json.token; // mobile session for the web-created user
const cookieA = ws.cookie; // web session for the same user
const nb = await req("/api/boards", { method: "POST", bearer: tokA, body: { title: `Mobile board ${stamp}`, kind: "generic" } });
check("mobile creates board", nb.status === 200 || nb.status === 201, JSON.stringify(nb));
const wb = await req("/api/boards", { cookie: cookieA });
check("web sees mobile-created board", JSON.stringify(wb.json).includes(`Mobile board ${stamp}`));
const g = await req("/api/studio/goals", { method: "POST", cookie: cookieA, body: { title: `Web goal ${stamp}` } });
check("web creates studio goal", g.status === 200 || g.status === 201, JSON.stringify(g));
const mg = await req("/api/studio/goals", { bearer: tokA });
check("mobile sees web-created goal", JSON.stringify(mg.json).includes(`Web goal ${stamp}`));

console.log("\n5. Every /api/mobile read endpoint (artist)");
const courses = await req("/api/mobile/courses", { bearer: tokA });
const slug = courses.json?.courses?.[0]?.slug;
const detail = slug ? await req(`/api/mobile/courses/${slug}`, { bearer: tokA }) : null;
const firstLesson = detail?.json?.modules?.[0]?.lessons?.[0]?.id;
const artistPaths = [
  "/api/mobile/me", "/api/mobile/dashboard", "/api/mobile/courses",
  ...(slug ? [`/api/mobile/courses/${slug}`] : []),
  ...(firstLesson ? [`/api/mobile/lessons/${firstLesson}`] : []),
  "/api/mobile/certificates", "/api/mobile/roadmaps", "/api/mobile/leaderboard", "/api/mobile/missions",
  "/api/mobile/studio", "/api/mobile/studio/dashboard", "/api/mobile/community", "/api/mobile/coach",
  "/api/mobile/audit", "/api/mobile/billing", "/api/mobile/boards/dashboard", "/api/notifications",
];
check("there is published course content", !!slug && !!firstLesson);
for (const p of artistPaths) {
  const r = await req(p, { bearer: tokA });
  check(`GET ${p} → 200`, r.status === 200, `${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
}

console.log("\n6. Admin permissions are enforced by the server");
const adminPaths = ["overview", "users", "courses", "content", "coupons", "moderation", "submissions", "security"].map((p) => `/api/mobile/admin/${p}`);
for (const p of adminPaths) check(`artist GET ${p} → 403`, (await req(p, { bearer: tokA })).status === 403);
const al = await req("/api/auth/login", { method: "POST", native: true, body: { email: "admin@riff.app", password: "admin12345" } });
const adminTok = al.json?.token;
check("seeded admin logs in on mobile", !!adminTok, JSON.stringify(al.json));
for (const p of adminPaths) check(`admin GET ${p} → 200`, (await req(p, { bearer: adminTok })).status === 200);
const cid = (await req("/api/mobile/admin/courses", { bearer: adminTok })).json?.courses?.[0]?.id;
if (cid) check("admin course editor → 200", (await req(`/api/mobile/admin/courses/${cid}`, { bearer: adminTok })).status === 200);

console.log("\n7. Role fix: reviewer can no longer act as admin; demotion is immediate");
const uid = ws.json.id;
const promote = await req(`/api/admin/users/${uid}`, { method: "PATCH", bearer: adminTok, body: { role: "reviewer" } });
check("admin promotes user to reviewer", promote.status === 200, JSON.stringify(promote));
// The user's existing token still says "artist"; the server re-reads the role.
const selfPromote = await req(`/api/admin/users/${uid}`, { method: "PATCH", bearer: tokA, body: { role: "admin" } });
check("reviewer cannot change roles (admin-only route) → 403", selfPromote.status === 403, JSON.stringify(selfPromote));
check("reviewer can read the review queue", (await req("/api/mobile/admin/submissions", { bearer: tokA })).status === 200);
await req(`/api/admin/users/${uid}`, { method: "PATCH", bearer: adminTok, body: { role: "artist" } });
check("demoted user loses staff access immediately", (await req("/api/mobile/admin/submissions", { bearer: tokA })).status === 403);

console.log("\n8. Web pages still work with the cookie");
for (const p of ["/dashboard", "/courses", "/boards", "/studio", "/settings"]) {
  const r = await fetch(BASE + p, { headers: { Cookie: cookieA }, redirect: "manual" });
  check(`web ${p} → 200`, r.status === 200, String(r.status));
}
const anon = await fetch(BASE + "/dashboard", { redirect: "manual" });
check("logged-out web /dashboard redirects", anon.status >= 300 && anon.status < 400, String(anon.status));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
