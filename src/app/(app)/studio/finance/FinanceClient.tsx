"use client";

import { useState } from "react";
import Link from "next/link";
import { Stat } from "@/components/ui";
import { toCents } from "@/lib/money";
import type { FinanceDTO } from "@/lib/studio-tools";

const CATS = ["streaming", "merch", "shows", "ads", "gear", "other"];
const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function FinanceClient({ initial }: { initial: FinanceDTO }) {
  const [data, setData] = useState<FinanceDTO>(initial);
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("streaming");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { ok, data } = await api("/api/studio/finance", "GET");
    if (ok) setData(data);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const cents = toCents(amount);
    if (!label.trim() || cents <= 0) return;
    setBusy(true);
    const { ok } = await api("/api/studio/finance", "POST", { kind, category, label: label.trim(), amount: cents });
    setBusy(false);
    if (ok) { setLabel(""); setAmount(""); reload(); }
  }
  async function del(id: string) {
    await api(`/api/studio/finance/${id}`, "DELETE");
    reload();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">💰 Revenue & Budget</h1>
      <p className="text-sm text-[var(--muted)] mb-6">Track what your music earns and costs — no spreadsheet required.</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat icon="📈" value={money(data.totals.income)} label="Income" />
        <Stat icon="📉" value={money(data.totals.expense)} label="Expenses" />
        <Stat icon="🧮" value={<span className={data.totals.net < 0 ? "text-[var(--brand-2)]" : "text-[var(--success)]"}>{money(data.totals.net)}</span>} label="Net" />
      </div>

      <form onSubmit={add} className="card p-4 mb-4 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto_auto]">
        <select value={kind} onChange={(e) => setKind(e.target.value as "income" | "expense")} className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none capitalize">
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Description" className="text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)]" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" className="w-24 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none" />
        <button type="submit" className="btn btn-primary text-sm" disabled={busy}>Add</button>
      </form>

      {data.byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.byCategory.map((c) => (
            <span key={c.category} className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] capitalize">
              {c.category}: <span className={c.net < 0 ? "text-[var(--brand-2)]" : "text-[var(--success)]"}>{money(c.net)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {data.entries.map((e) => (
          <div key={e.id} className="card p-3 flex items-center gap-3 group">
            <span className="text-lg">{e.kind === "income" ? "＋" : "－"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{e.label}</div>
              <div className="text-xs text-[var(--muted)] capitalize">{e.category} · {fmtDate(e.date)}</div>
            </div>
            <span className={`text-sm font-medium whitespace-nowrap ${e.kind === "income" ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>{e.kind === "income" ? "+" : "−"}{money(e.amount)}</span>
            <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => del(e.id)}>✕</button>
          </div>
        ))}
        {data.entries.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">No entries yet — add your first income or expense.</p>}
      </div>
    </main>
  );
}
