import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

// Fail fast in production if the secret is missing/weak — never silently fall back
// to a forgeable default (audit finding C2).
function resolveSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a >=32 char secret in production");
    }
    console.warn("[auth] JWT_SECRET missing/weak — using an insecure dev secret. Do NOT use in production.");
    return "dev-only-insecure-secret-change-me-32+chars";
  }
  return s;
}
const SECRET = resolveSecret();
const COOKIE = "riff_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_COST = 12;

export type SessionUser = { id: string; email: string; role: string };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, BCRYPT_COST);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signToken(user: SessionUser) {
  return jwt.sign(user, SECRET, { expiresIn: MAX_AGE });
}

/**
 * Header a native client (the Expo app in mobile/) sends so login/signup hand the
 * session token back in the JSON body. Browsers never send it, so the web keeps
 * receiving only the httpOnly cookie.
 */
export const NATIVE_CLIENT_HEADER = "x-riff-client";

export function isNativeClient(req: Request) {
  return req.headers.get(NATIVE_CLIENT_HEADER) === "native";
}

/** Extract the token from an `Authorization: Bearer <jwt>` header value. */
export function bearerToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return m ? m[1] : null;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, SECRET) as SessionUser & { iat: number; exp: number };
    return { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

/** Sets the session cookie and returns the token (native clients get it in the body). */
export async function setSession(user: SessionUser): Promise<string> {
  const token = signToken(user);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return token;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

// The same JWT is accepted from the web's cookie or a native client's
// `Authorization: Bearer` header. A bearer value that isn't a valid session token
// (e.g. the cron route's CRON_SECRET) is ignored and the cookie is tried instead.
export async function getSession(): Promise<SessionUser | null> {
  const bearer = bearerToken((await headers()).get("authorization"));
  if (bearer) {
    const fromHeader = verifyToken(bearer);
    if (fromHeader) return fromHeader;
  }
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Full user record for the current session (or null).
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}

/**
 * Session for a signed-in page, redirecting to /login when there is none.
 *
 * Layouts and pages render in parallel, so the (app) layout's redirect does not
 * guarantee a page has a session by the time it runs. Asserting non-null there
 * threw "Cannot read properties of null (reading 'id')" on every logged-out hit.
 */
export async function requirePageSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated");
  return session;
}

export class AuthError extends Error {}
