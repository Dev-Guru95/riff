import { cookies } from "next/headers";
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

export async function setSession(user: SessionUser) {
  const token = signToken(user);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, SECRET) as SessionUser & { iat: number; exp: number };
    return { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
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
