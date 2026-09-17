"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";
import { Wordmark } from "./Wordmark";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";

// Artist-facing shell navigation. Replaces the former horizontal TopNav with
// the persistent sidebar from the redesign. Below lg it collapses into a top
// bar with a slide-down drawer — the same pattern AdminNav already uses, so
// both shells behave identically on a phone.

type NavItem = { href: string; label: string; icon: IconName };

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/courses", label: "Courses", icon: "book" },
  { href: "/coach", label: "Coach", icon: "chat" },
  { href: "/missions", label: "Missions", icon: "target" },
  { href: "/studio", label: "Studio", icon: "disc" },
  { href: "/boards", label: "Projects", icon: "kanban" },
  { href: "/audit", label: "Audit", icon: "layers" },
  { href: "/roadmap", label: "Roadmap", icon: "route" },
  { href: "/community", label: "Community", icon: "community" },
  { href: "/leaderboard", label: "Ranks", icon: "trophy" },
  { href: "/pricing", label: "Plans", icon: "card" },
];

// "/boards" should stay lit on "/boards/abc", but "/" must not match everything.
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UserNav({
  email,
  name,
  plan,
  isAdmin,
}: {
  email?: string;
  name?: string;
  plan?: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  // Close on navigation. Adjusted during render rather than in an effect so the
  // stale open drawer is never painted over the new page.
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

  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin", icon: "shield" as const }] : LINKS;
  const displayName = name ?? email?.split("@")[0] ?? "artist";

  const itemLink = (n: NavItem) => {
    const active = isActive(pathname, n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
          active
            ? "bg-[var(--surface-2)] text-[var(--foreground)] font-semibold"
            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        }`}
      >
        <Icon name={n.icon} size={17} className="shrink-0" />
        {n.label}
      </Link>
    );
  };

  const footer = email ? (
    <div className="pt-3 border-t border-[var(--border)]">
      <div className="flex items-center gap-2.5 px-2 py-1.5 min-w-0">
        <Avatar name={displayName} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{displayName}</div>
          <div className="text-xs text-[var(--muted)] capitalize truncate">{plan ?? "free"}</div>
        </div>
      </div>
      <div className="px-1 pt-2">
        <LogoutButton />
      </div>
    </div>
  ) : (
    <div className="pt-3 border-t border-[var(--border)] px-1">
      <Link href="/login" className="btn btn-ghost w-full">
        Log in
      </Link>
    </div>
  );

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Wordmark href="/dashboard" />
          <div className="flex items-center gap-1">
            {email && <NotificationBell />}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls={menuId}
              className="p-2 -mr-2 rounded-lg hover:bg-[var(--surface-2)] transition"
            >
              <Icon name={open ? "close" : "menu"} size={24} strokeWidth={2} />
            </button>
          </div>
        </div>
        {open && (
          <div
            id={menuId}
            className="absolute top-full left-0 right-0 bg-[var(--background)] border-b border-[var(--border)] shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto"
          >
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {links.map(itemLink)}
              {footer}
            </div>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-[var(--border)] p-4 flex-col gap-0.5 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-5 px-2">
          <Wordmark href="/dashboard" />
          {email && <NotificationBell />}
        </div>
        {links.map(itemLink)}
        <div className="mt-auto">{footer}</div>
      </aside>
    </>
  );
}
