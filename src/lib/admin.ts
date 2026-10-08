import { prisma } from "./prisma";
import { getSession, type SessionUser } from "./auth";
import { fail } from "./api";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["admin", "reviewer", "moderator"];
export type StaffRole = "admin" | "reviewer" | "moderator";

/**
 * Whether `role` may use a route that needs `minRole`. Admin can do everything;
 * reviewer and moderator are each scoped to their own routes, so neither passes
 * an admin-only check.
 */
export function roleSatisfies(role: string, minRole: StaffRole): boolean {
  return role === "admin" || role === minRole;
}

/**
 * The session with its role re-read from the database. The JWT carries the role
 * it was issued with, so trusting it alone would let a demoted or suspended user
 * keep staff access until the token expires.
 */
async function freshStaffSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, status: true },
  });
  if (!user || user.status !== "active") return null;
  return { ...session, role: user.role };
}

/** For server components / pages. Returns the session if privileged, else null. */
export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await freshStaffSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) return null;
  return session;
}

/** For API routes. Returns {session} or {error: NextResponse}. */
export async function requireAdmin(
  minRole: StaffRole = "reviewer",
): Promise<{ session: SessionUser; error?: never } | { session?: never; error: NextResponse }> {
  if (!(await getSession())) return { error: fail("Not authenticated", 401) };
  const session = await freshStaffSession();
  if (!session || !roleSatisfies(session.role, minRole)) {
    return { error: fail("Forbidden — admin access required", 403) };
  }
  return { session };
}

/** Append-only audit trail for privileged actions. */
export async function writeAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: { actorId, action, entity, entityId: entityId ?? null, meta: JSON.stringify(meta ?? {}) },
  });
}
