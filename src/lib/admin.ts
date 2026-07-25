import { prisma } from "./prisma";
import { getSession, type SessionUser } from "./auth";
import { fail } from "./api";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["admin", "reviewer", "moderator"];

/** For server components / pages. Returns the session if privileged, else null. */
export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) return null;
  return session;
}

/** For API routes. Returns {session} or {error: NextResponse}. */
export async function requireAdmin(
  minRole: "admin" | "reviewer" | "moderator" = "reviewer",
): Promise<{ session: SessionUser; error?: never } | { session?: never; error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: fail("Not authenticated", 401) };
  // admin can do everything; reviewer/moderator are scoped but allowed here.
  const allowed = session.role === "admin" || session.role === minRole || ADMIN_ROLES.includes(session.role);
  if (!allowed) return { error: fail("Forbidden — admin access required", 403) };
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
