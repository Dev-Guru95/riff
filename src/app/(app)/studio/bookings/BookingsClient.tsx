"use client";

import { useState } from "react";
import Link from "next/link";
import { toCents } from "@/lib/money";
import type { BookingDTO } from "@/lib/studio-growth";

const STATUS = ["inquiry", "held", "confirmed", "done", "declined"];
const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function BookingsClient({ initial }: { initial: BookingDTO[] }) {
  const [bookings, setBookings] = useState<BookingDTO[]>(initial);
  const [title, setTitle] = useState("");

  async function reload() { const { ok, data } = await api("/api/studio/bookings", "GET"); if (ok) setBookings(data.bookings); }
  async function add() { const t = title.trim(); if (!t) return; setTitle(""); await api("/api/studio/bookings", "POST", { title: t }); reload(); }
  async function patch(id: string, d: Partial<BookingDTO>) { setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...d } : b))); const { ok } = await api(`/api/studio/bookings/${id}`, "PATCH", d); if (!ok) reload(); }
  async function del(id: string) { setBookings((bs) => bs.filter((b) => b.id !== id)); const { ok } = await api(`/api/studio/bookings/${id}`, "DELETE"); if (!ok) reload(); }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">📆 Booking Scheduler</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Track show inquiries and bookings from first contact to confirmed.</p>

      <div className="flex gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New booking (e.g. Summer Fest slot)" className={`flex-1 ${inp}`} />
        <button className="btn btn-primary text-sm" onClick={add}>Add</button>
      </div>

      <div className="space-y-2">
        {bookings.map((b) => (
          <div key={b.id} className="card p-3 group">
            <div className="flex items-center gap-2">
              <input defaultValue={b.title} onBlur={(e) => e.target.value.trim() && patch(b.id, { title: e.target.value.trim() })} className={`flex-1 font-medium ${inp}`} />
              <select value={b.status} onChange={(e) => patch(b.id, { status: e.target.value })} className={`${inp} capitalize`}>{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button className="text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => del(b.id)}>✕</button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input defaultValue={b.contact} onBlur={(e) => patch(b.id, { contact: e.target.value })} placeholder="Contact / promoter" className={`w-40 ${inp}`} />
              <input type="date" defaultValue={b.date ? b.date.slice(0, 10) : ""} onChange={(e) => patch(b.id, { date: e.target.value ? new Date(e.target.value + "T12:00:00.000Z").toISOString() : "" })} className={inp} />
              <label className="text-xs text-[var(--muted)]">Fee <input defaultValue={b.fee ? b.fee / 100 : ""} onBlur={(e) => patch(b.id, { fee: toCents(e.target.value) })} inputMode="decimal" placeholder="0" className={`w-16 ${inp}`} /></label>
            </div>
          </div>
        ))}
        {bookings.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">No bookings yet.</p>}
      </div>
    </main>
  );
}
