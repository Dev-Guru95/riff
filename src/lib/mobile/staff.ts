import type { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { getAdminSession } from "@/lib/admin";
import { fail } from "@/lib/api";

/**
 * The same gate as src/app/(admin)/admin/layout.tsx — any active staff role
 * (admin | reviewer | moderator), re-read from the database — but answered with
 * 401 (no session) / 403 (not staff) instead of a redirect. The admin pages add
 * no per-page role checks of their own; the WRITE routes they call do
 * (requireAdmin("admin" | "reviewer" | "moderator")).
 */
export async function requireStaff(): Promise<
  { session: SessionUser; error?: never } | { session?: never; error: NextResponse }
> {
  if (!(await getSession())) return { error: fail("Not authenticated", 401) };
  const session = await getAdminSession();
  if (!session) return { error: fail("Forbidden — admin access required", 403) };
  return { session };
}
