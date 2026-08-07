"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";

// Client component because the mobile drawer needs toggle state and the active
// link needs usePathname. Kept out of components/ui.tsx so that file stays
// importable from Server Components.

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/coach", label: "Coach" },
  { href: "/missions", label: "Missions" },
  { href: "/studio", label: "Studio" },
  { href: "/boards", label: "Projects" },
  { href: "/audit", label: "Audit" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/community", label: "Community" },
  { href: "/leaderboard", label: "Ranks" },
  { href: "/pricing", label: "Plans" },
];

// "/boards" should stay lit on "/boards/abc", but "/" must not match everything.
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ email, isAdmin }: { email?: string; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  // Close on navigation — otherwise the drawer stays open on top of the new
  // page. Adjusted during render rather than in an effect: React re-renders
  // immediately without painting the stale open drawer first.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Escape closes the drawer, matching normal menu behaviour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <nav className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2 shrink-0">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>

        {/* Desktop. Only from xl: the full set needs ~1100px and would otherwise
            wrap inside the fixed h-14 bar, spilling out below the border. */}
        <div className="hidden xl:flex items-center gap-0.5 text-sm flex-nowrap">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} active={isActive(pathname, l.href)}>
              {l.label}
            </NavLink>
          ))}
          {email && <NotificationBell />}
          {email ? (
            <span className="ml-2">
              <LogoutButton />
            </span>
          ) : (
            <NavLink href="/login" active={isActive(pathname, "/login")}>
              Log in
            </NavLink>
          )}
        </div>

        {/* Mobile / tablet */}
        <div className="flex xl:hidden items-center gap-1">
          {email && <NotificationBell />}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            className="p-2 -mr-2 rounded-lg hover:bg-[var(--surface-2)] transition"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Drawer. Absolute so it overlays the page instead of stretching the
          sticky bar; scrolls internally when the viewport is short. */}
      {open && (
        <div
          id={menuId}
          className="xl:hidden absolute top-full left-0 right-0 bg-[var(--background)] border-b border-[var(--border)] shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto"
        >
          <div className="px-3 py-2 flex flex-col gap-0.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={`px-3 py-2.5 rounded-lg transition ${
                  isActive(pathname, l.href)
                    ? "bg-[var(--surface-2)] text-[var(--brand)] font-medium"
                    : "hover:bg-[var(--surface-2)]"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              {email ? (
                <div className="px-1 pb-1">
                  <div className="px-2 pb-2 text-xs text-[var(--muted)] truncate">{email}</div>
                  <LogoutButton />
                </div>
              ) : (
                <Link href="/login" className="block px-3 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
        active ? "bg-[var(--surface-2)] text-[var(--brand)] font-medium" : "hover:bg-[var(--surface-2)]"
      }`}
    >
      {children}
    </Link>
  );
}
