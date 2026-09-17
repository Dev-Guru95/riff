"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { Wordmark } from "./Wordmark";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";

// Admin shell navigation. Below lg the fixed sidebar swallowed most of a phone
// screen and could not be dismissed, so there it collapses into a top bar with
// a slide-down drawer; from lg up it is the persistent sidebar.

export type AdminNavItem = { href: string; label: string; icon: IconName };

function isActive(pathname: string, href: string) {
  // "/admin" is a prefix of every admin route, so it must match exactly.
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  items,
  email,
  name,
  role,
}: {
  items: AdminNavItem[];
  email: string;
  name?: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  // Close on navigation. Adjusted during render, not in an effect, so the stale
  // open drawer is never painted over the new page.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const displayName = name ?? email.split("@")[0];

  const itemLink = (n: AdminNavItem) => {
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

  const footer = (
    <div className="pt-3 border-t border-[var(--border)]">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
      >
        <Icon name="chevronLeft" size={16} /> Artist view
      </Link>
      <div className="flex items-center gap-2.5 px-2 py-1.5 mt-1 min-w-0">
        <Avatar name={displayName} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{displayName}</div>
          <div className="text-xs text-[var(--muted)] capitalize truncate">{role ?? "admin"}</div>
        </div>
      </div>
      <div className="px-1 pt-2">
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Wordmark href="/admin" suffix="admin" />
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
        {open && (
          <div
            id={menuId}
            className="absolute top-full left-0 right-0 bg-[var(--background)] border-b border-[var(--border)] shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto"
          >
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {items.map(itemLink)}
              {footer}
            </div>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-[var(--border)] p-4 flex-col gap-0.5 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-5 px-2">
          <Wordmark href="/admin" suffix="admin" />
        </div>
        {items.map(itemLink)}
        <div className="mt-auto">{footer}</div>
      </aside>
    </>
  );
}
