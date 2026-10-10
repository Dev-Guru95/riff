// Who may do what in the admin area — mirrored from the server, never invented.
//
// Every admin READ endpoint (/api/mobile/admin/*) admits any active staff member
// (admin, reviewer, moderator), exactly like the web's (admin)/admin/layout.tsx,
// whose nav shows every section to all staff. WRITES are role-checked by
// `requireAdmin(x)`, which admits only `admin` or exactly `x` (not a hierarchy):
//   reviewer  → PATCH /api/admin/submissions/:id
//   moderator → PATCH /api/admin/reports/:id
//   admin     → everything else
// So the app shows every section, and hides only the write controls the server
// would refuse. The role comes from /api/mobile/me (re-read from the database);
// the server re-checks it on every request regardless.

import type { Href } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import type { IconName } from "@/components/ui";

export type StaffRole = "admin" | "reviewer" | "moderator";

export function useStaffAccess() {
  const { user } = useAuth();
  const role = user?.user.role ?? "";
  return {
    role,
    /** True when the server's `requireAdmin(required)` would admit this user. */
    can: (required: StaffRole) => role === "admin" || role === required,
  };
}

export type AdminNavItem = { href: Href & string; label: string; icon: IconName };

/**
 * Same items, order, labels and icons as the web admin nav
 * (src/app/(admin)/admin/layout.tsx). "Import Course" is absent there too: it
 * lives in the "New course" menu on /admin/courses.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "grid" },
  { href: "/admin/courses", label: "Courses", icon: "book" },
  { href: "/admin/submissions", label: "Review Queue", icon: "clipboard" },
  { href: "/admin/moderation", label: "Moderation", icon: "shield" },
  { href: "/admin/users", label: "Users", icon: "user" },
  { href: "/admin/coupons", label: "Coupons", icon: "ticket" },
  { href: "/admin/content", label: "AI Content", icon: "sparkles" },
  { href: "/admin/security", label: "Security", icon: "lock" },
];

/** The web's AdminNav isActive(): "/admin" matches exactly, the rest by prefix. */
export function isNavActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
