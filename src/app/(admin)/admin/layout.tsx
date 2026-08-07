import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { AdminNav, type AdminNavItem } from "@/components/AdminNav";

const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/courses", label: "Courses", icon: "🎓" },
  { href: "/admin/import", label: "Import Course", icon: "📥" },
  { href: "/admin/submissions", label: "Review Queue", icon: "📝" },
  { href: "/admin/moderation", label: "Moderation", icon: "🛡️" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/coupons", label: "Coupons", icon: "🎟️" },
  { href: "/admin/content", label: "AI Content", icon: "🤖" },
  { href: "/admin/security", label: "Security", icon: "🔐" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  // Column below lg (nav is a top bar), row from lg up (nav is a sidebar).
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <AdminNav items={NAV} email={session.email} />
      <main className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
