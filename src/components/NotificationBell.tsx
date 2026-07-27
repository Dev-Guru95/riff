"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type Notif = { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

const ICON: Record<string, string> = { badge: "🏅", levelup: "⬆️", mission: "🎯", audit: "📈", reward: "🎁", community: "💬", certificate: "🎓", system: "🔔", mention: "📣", comment: "💬", task: "✅", due: "⏰", board: "🗂️" };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setUnread(d.unread);
    }
  }

  useEffect(() => {
    // load() only setStates after an awaited fetch (never synchronously), so this
    // is safe on-mount polling — the lint rule can't see past the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30_000); // light polling
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="px-2 py-1.5 rounded-lg hover:bg-[var(--surface-2)] relative" aria-label="Notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[var(--brand-2)] text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-2 max-h-96 overflow-y-auto z-30 shadow-xl">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`p-2.5 rounded-lg ${n.read ? "" : "bg-[var(--surface-2)]"}`}>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span>{ICON[n.type] ?? "🔔"}</span> {n.title}
                  </div>
                  {n.body && <div className="text-xs text-[var(--muted)] ml-6">{n.body}</div>}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className="block hover:opacity-80">{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
