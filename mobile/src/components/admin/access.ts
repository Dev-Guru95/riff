// Who may do what in the admin area — mirrored from the server, never invented.
//
// Every admin READ endpoint (/api/mobile/admin/*) admits any active staff member
// (admin, reviewer, moderator), exactly like the web's (admin)/admin/layout.tsx,
// whose nav shows every section to all staff. WRITES are role-checked by
// `requireAdmin(x)`, which admits only `admin` or exactly `x` (not a hierarchy):
//   reviewer  → PATCH /api/admin/submissions/:id
//   moderator → PATCH /api/admin/reports/:id
//   admin     → everything
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

export type AdminSection = {
  href: Href;
  label: string;
  icon: IconName;
  body: string;
  /** Role the section's write routes require (requireAdmin argument). */
  writeRole: StaffRole | null;
};

/** Same order and icons as the web admin nav (src/app/(admin)/admin/layout.tsx). */
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin/courses", label: "Courses", icon: "book", body: "Create, edit and publish tracks", writeRole: "admin" },
  { href: "/admin/submissions", label: "Review Queue", icon: "clipboard", body: "Confirm or override AI reviews", writeRole: "reviewer" },
  { href: "/admin/moderation", label: "Moderation", icon: "shield", body: "Reported threads, posts and users", writeRole: "moderator" },
  { href: "/admin/users", label: "Users", icon: "user", body: "Roles, tiers and Skool access", writeRole: "admin" },
  { href: "/admin/coupons", label: "Coupons", icon: "ticket", body: "Discount codes and rewards", writeRole: "admin" },
  { href: "/admin/content", label: "AI Content", icon: "sparkles", body: "Approve AI content suggestions", writeRole: "admin" },
  { href: "/admin/security", label: "Security", icon: "lock", body: "Two-factor authentication", writeRole: null },
];
