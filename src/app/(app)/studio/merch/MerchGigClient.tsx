"use client";

import { useState } from "react";
import Link from "next/link";
import { toCents } from "@/lib/money";
import type { MerchDTO, GigDTO } from "@/lib/studio-tools";

const MERCH_STATUS = ["idea", "design", "production", "for_sale", "sold_out"];
const GIG_STATUS = ["inquiry", "confirmed", "done", "cancelled"];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function MerchGigClient({ initial }: { initial: { merch: MerchDTO[]; gigs: GigDTO[] } }) {
  const [merch, setMerch] = useState<MerchDTO[]>(initial.merch);
  const [gigs, setGigs] = useState<GigDTO[]>(initial.gigs);
  const [newMerch, setNewMerch] = useState("");
  const [newGig, setNewGig] = useState("");

  async function reload() {
    const { ok, data } = await api("/api/studio/merch-gigs", "GET");
    if (ok) { setMerch(data.merch); setGigs(data.gigs); }
  }

  async function addMerch() {
    const name = newMerch.trim(); if (!name) return;
    setNewMerch("");
    await api("/api/studio/merch-gigs", "POST", { type: "merch", name });
    reload();
  }
  async function patchMerch(id: string, data: Partial<MerchDTO>) {
    setMerch((ms) => ms.map((m) => (m.id === id ? { ...m, ...data } : m)));
    const { ok } = await api(`/api/studio/merch/${id}`, "PATCH", data);
    if (!ok) reload(); // revert to server truth on failure
  }
  async function delMerch(id: string) {
    setMerch((ms) => ms.filter((m) => m.id !== id));
    const { ok } = await api(`/api/studio/merch/${id}`, "DELETE");
    if (!ok) reload();
  }

  async function addGig() {
    const venue = newGig.trim(); if (!venue) return;
    setNewGig("");
    await api("/api/studio/merch-gigs", "POST", { type: "gig", venue });
    reload();
  }
  async function patchGig(id: string, data: Partial<GigDTO>) {
    setGigs((gs) => gs.map((g) => (g.id === id ? { ...g, ...data } : g)));
    const { ok } = await api(`/api/studio/gigs/${id}`, "PATCH", data);
    if (!ok) reload();
  }
  async function delGig(id: string) {
    setGigs((gs) => gs.filter((g) => g.id !== id));
    const { ok } = await api(`/api/studio/gigs/${id}`, "DELETE");
    if (!ok) reload();
  }

  const inp = "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">🧢 Merch & Gigs</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Plan your merch drops and track your shows.</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Merch */}
        <section>
          <h2 className="font-semibold text-sm mb-2">Merch</h2>
          <div className="flex gap-2 mb-3">
            <input value={newMerch} onChange={(e) => setNewMerch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMerch()} placeholder="New merch item (e.g. Tour tee)" className={`flex-1 ${inp}`} />
            <button className="btn btn-primary text-sm" onClick={addMerch}>Add</button>
          </div>
          <div className="space-y-2">
            {merch.map((m) => (
              <div key={m.id} className="card p-3 group">
                <div className="flex items-center gap-2">
                  <input defaultValue={m.name} onBlur={(e) => e.target.value.trim() && patchMerch(m.id, { name: e.target.value.trim() })} className={`flex-1 font-medium ${inp}`} />
                  <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => delMerch(m.id)}>✕</button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <select value={m.status} onChange={(e) => patchMerch(m.id, { status: e.target.value })} className={`${inp} capitalize`}>
                    {MERCH_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                  <label className="text-xs text-[var(--muted)]">Price <input defaultValue={m.price ? m.price / 100 : ""} onBlur={(e) => patchMerch(m.id, { price: toCents(e.target.value) })} inputMode="decimal" placeholder="0" className={`w-16 ${inp}`} /></label>
                  <label className="text-xs text-[var(--muted)]">Stock <input defaultValue={m.stock || ""} onBlur={(e) => patchMerch(m.id, { stock: Math.max(0, parseInt(e.target.value) || 0) })} inputMode="numeric" placeholder="0" className={`w-14 ${inp}`} /></label>
                </div>
              </div>
            ))}
            {merch.length === 0 && <p className="text-xs text-[var(--muted)]">No merch yet.</p>}
          </div>
        </section>

        {/* Gigs */}
        <section>
          <h2 className="font-semibold text-sm mb-2">Gigs</h2>
          <div className="flex gap-2 mb-3">
            <input value={newGig} onChange={(e) => setNewGig(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGig()} placeholder="New gig (venue name)" className={`flex-1 ${inp}`} />
            <button className="btn btn-primary text-sm" onClick={addGig}>Add</button>
          </div>
          <div className="space-y-2">
            {gigs.map((g) => (
              <div key={g.id} className="card p-3 group">
                <div className="flex items-center gap-2">
                  <input defaultValue={g.venue} onBlur={(e) => e.target.value.trim() && patchGig(g.id, { venue: e.target.value.trim() })} className={`flex-1 font-medium ${inp}`} />
                  <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => delGig(g.id)}>✕</button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <input defaultValue={g.city} onBlur={(e) => patchGig(g.id, { city: e.target.value })} placeholder="City" className={`w-24 ${inp}`} />
                  <input type="date" defaultValue={g.date ? g.date.slice(0, 10) : ""} onChange={(e) => patchGig(g.id, { date: e.target.value ? new Date(e.target.value + "T12:00:00.000Z").toISOString() : "" })} className={inp} />
                  <select value={g.status} onChange={(e) => patchGig(g.id, { status: e.target.value })} className={`${inp} capitalize`}>
                    {GIG_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <label className="text-xs text-[var(--muted)]">Fee <input defaultValue={g.fee ? g.fee / 100 : ""} onBlur={(e) => patchGig(g.id, { fee: toCents(e.target.value) })} inputMode="decimal" placeholder="0" className={`w-16 ${inp}`} /></label>
                </div>
              </div>
            ))}
            {gigs.length === 0 && <p className="text-xs text-[var(--muted)]">No gigs yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
