"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogoutButton } from "./LogoutButton";

// Admin shell navigation. Below lg the fixed 14rem sidebar swallowed most of a
// phone screen and could not be dismissed, so there it collapses into a top bar
// with a slide-down drawer; from lg up it is the original persistent sidebar.

export type AdminNavItem = { href: string; label: string; icon: string };

function isActive(pathname: string, href: string) {
  // "/admin" is a prefix of every admin route, so it must match exactly.
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items, email }: { items: AdminNavItem[]; email: string }) {
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

  const brand = (
    <Link href="/admin" className="font-bold text-lg flex items-center gap-2">
      <span className="text-[var(--brand)]">●</span> Riff{" "}
      <span className="text-xs text-[var(--muted)] font-normal">admin</span>
    </Link>
  );

  const itemLink = (n: AdminNavItem) => (
    <Link
      key={n.href}
      href={n.href}
      aria-current={isActive(pathname, n.href) ? "page" : undefined}
      className={`px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        isActive(pathname, n.href)
          ? "bg-[var(--surface-2)] text-[var(--brand)] font-medium"
          : "hover:bg-[var(--surface-2)]"
      }`}
    >
      <span aria-hidden="true">{n.icon}</span> {n.label}
    </Link>
  );

  const footer = (
    <div className="pt-4 border-t border-[var(--border)] space-y-2">
      <Link
        href="/dashboard"
        className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] transition block"
      >
        ← Artist view
      </Link>
      <div className="px-3 text-xs text-[var(--muted)] truncate">{email}</div>
      <div className="px-1">
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          {brand}
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

      {/* Desktop sidebar — unchanged behaviour */}
      <aside className="hidden lg:flex w-56 border-r border-[var(--border)] p-4 flex-col gap-1 shrink-0">
        <div className="mb-4 px-2">{brand}</div>
        {items.map(itemLink)}
        <div className="mt-auto">{footer}</div>
      </aside>
    </>
  );
}
