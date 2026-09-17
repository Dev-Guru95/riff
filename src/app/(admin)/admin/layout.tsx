import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { AdminNav, type AdminNavItem } from "@/components/AdminNav";

// "Import Course" is intentionally absent here: the redesign moves it into the
// "New course" split button on /admin/courses. The route is unchanged.
const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "grid" },
  { href: "/admin/courses", label: "Courses", icon: "book" },
  { href: "/admin/submissions", label: "Review Queue", icon: "clipboard" },
  { href: "/admin/moderation", label: "Moderation", icon: "shield" },
  { href: "/admin/users", label: "Users", icon: "user" },
  { href: "/admin/coupons", label: "Coupons", icon: "ticket" },
  { href: "/admin/content", label: "AI Content", icon: "sparkles" },
  { href: "/admin/security", label: "Security", icon: "lock" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.id },
    select: { stageName: true },
  });

  // Column below lg (nav is a top bar), row from lg up (nav is a sidebar).
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <AdminNav
        items={NAV}
        email={session.email}
        name={profile?.stageName ?? undefined}
        role={session.role}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
