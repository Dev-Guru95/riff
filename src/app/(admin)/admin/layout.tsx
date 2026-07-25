import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
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

  return (
    <div className="flex-1 flex min-h-screen">
      <aside className="w-56 border-r border-[var(--border)] p-4 flex flex-col gap-1 shrink-0">
        <Link href="/admin" className="font-bold text-lg flex items-center gap-2 mb-4 px-2">
          <span className="text-[var(--brand)]">●</span> Riff <span className="text-xs text-[var(--muted)] font-normal">admin</span>
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)] transition flex items-center gap-2">
            <span>{n.icon}</span> {n.label}
          </Link>
        ))}
        <div className="mt-auto pt-4 border-t border-[var(--border)] space-y-2">
          <Link href="/dashboard" className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] transition block">
            ← Artist view
          </Link>
          <div className="px-3 text-xs text-[var(--muted)] truncate">{session.email}</div>
          <div className="px-1"><LogoutButton /></div>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
