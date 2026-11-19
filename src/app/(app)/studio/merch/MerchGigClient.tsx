"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toCents, formatMoney } from "@/lib/money";
import {
  MERCH_STAGES,
  MERCH_TEMPLATES,
  catalogueTotals,
  stageFor,
  suggestPriceCents,
  unitEconomics,
  type MerchPlanResult,
  type MerchTemplate,
} from "@/lib/merch";
import type { MerchDTO, GigDTO } from "@/lib/studio-tools";

const GIG_STATUS = ["inquiry", "confirmed", "done", "cancelled"];

/** What the planner is for, in four steps. Shown once, at the top. */
const HOW_IT_WORKS = [
  { n: 1, title: "Plan", body: "Add an item — from scratch, a template, or an AI concept. It starts as an idea; nothing is committed." },
  { n: 2, title: "Price", body: "Enter what a unit costs you and what you'll charge. The planner shows your profit per unit and how many sales clear the run." },
  { n: 3, title: "Produce", body: "Move it to Production when you order, and log what the run cost. That expense lands in Revenue & Budget." },
  { n: 4, title: "Promote & sell", body: "Mark it For sale, then log each sale. Stock comes down and the income lands in Revenue automatically." },
];

const TONE_CLASS: Record<string, string> = {
  muted: "text-[var(--muted)] bg-[var(--surface-2)]",
  accent: "text-[var(--accent)] bg-[var(--accent)]/10",
  warning: "text-[var(--warning)] bg-[var(--warning)]/10",
  success: "text-[var(--success)] bg-[var(--success)]/10",
  brand: "text-[var(--brand)] bg-[var(--brand)]/10",
};

const HEALTH_CLASS: Record<string, string> = {
  unpriced: "text-[var(--muted)]",
  loss: "text-[var(--brand-2)]",
  thin: "text-[var(--warning)]",
  ok: "text-[var(--foreground)]",
  strong: "text-[var(--success)]",
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export function MerchGigClient({
  initial,
  currency,
  ai,
}: {
  initial: { merch: MerchDTO[]; gigs: GigDTO[] };
  currency: string;
  /** What this artist's plan allows from the AI planner. */
  ai: { limit: number; used: number; remaining: number; campaigns: boolean; plan: "free" | "pro" | "premium" };
}) {
  const [merch, setMerch] = useState<MerchDTO[]>(initial.merch);
  const [gigs, setGigs] = useState<GigDTO[]>(initial.gigs);
  const [newMerch, setNewMerch] = useState("");
  const [newGig, setNewGig] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(initial.merch.length === 0);

  const money = (cents: number) => formatMoney(cents, currency);
  const totals = useMemo(() => catalogueTotals(merch), [merch]);

  async function reload() {
    const { ok, data } = await api("/api/studio/merch-gigs", "GET");
    if (ok) {
      setMerch((data.merch as MerchDTO[]) ?? []);
      setGigs((data.gigs as GigDTO[]) ?? []);
    }
  }

  function flash(message: string) {
    setErr(null);
    setNote(message);
  }

  // ---- Merch ----
  async function addMerchItem(seed?: Partial<MerchDTO> & { name: string }) {
    const name = (seed?.name ?? newMerch).trim();
    if (!name) return;
    if (!seed) setNewMerch("");
    const { ok, data } = await api("/api/studio/merch-gigs", "POST", {
      type: "merch",
      name,
      ...(seed?.cost !== undefined ? { cost: seed.cost } : {}),
      ...(seed?.price !== undefined ? { price: seed.price } : {}),
      ...(seed?.stock !== undefined ? { stock: seed.stock } : {}),
      ...(seed?.notes !== undefined ? { notes: seed.notes } : {}),
    });
    if (!ok) {
      setErr((data.error as string) ?? "Could not add that item.");
      return;
    }
    await reload();
    flash(`Added “${name}”.`);
  }

  async function patchMerch(id: string, data: Partial<MerchDTO>) {
    setMerch((ms) => ms.map((m) => (m.id === id ? { ...m, ...data } : m)));
    const { ok } = await api(`/api/studio/merch/${id}`, "PATCH", data);
    if (!ok) reload(); // revert to server truth on failure
  }

  async function delMerch(id: string) {
    const item = merch.find((m) => m.id === id);
    if (item && !confirm(`Delete “${item.name}”? Sales already logged in Revenue stay there.`)) return;
    setMerch((ms) => ms.filter((m) => m.id !== id));
    const { ok } = await api(`/api/studio/merch/${id}`, "DELETE");
    if (!ok) reload();
  }

  async function logSale(item: MerchDTO) {
    const answer = prompt(`How many “${item.name}” sold?`, "1");
    if (answer === null) return;
    const units = Math.max(1, parseInt(answer, 10) || 0);
    const { ok, data } = await api(`/api/studio/merch/${item.id}/sale`, "POST", { kind: "sale", units });
    if (!ok) {
      setNote(null);
      setErr((data.error as string) ?? "Could not log that sale.");
      return;
    }
    await reload();
    flash(
      `Logged ${data.units} x ${item.name} — ${money(Number(data.revenueCents) || 0)} income (${money(Number(data.profitCents) || 0)} profit) added to Revenue.`,
    );
  }

  async function logRunCost(item: MerchDTO) {
    const answer = prompt(`How many units did you order of “${item.name}”?`, String(item.stock || 1));
    if (answer === null) return;
    const units = Math.max(1, parseInt(answer, 10) || 0);
    const { ok, data } = await api(`/api/studio/merch/${item.id}/sale`, "POST", { kind: "run_cost", units });
    if (!ok) {
      setNote(null);
      setErr((data.error as string) ?? "Could not log that cost.");
      return;
    }
    flash(`Logged ${money(Number(data.expenseCents) || 0)} of production cost to Revenue & Budget.`);
  }

  // ---- Gigs ----
  async function addGig() {
    const venue = newGig.trim();
    if (!venue) return;
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

  const inp =
    "text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 outline-none focus:border-[var(--brand)]";
  const confirmedFees = gigs
    .filter((g) => g.status === "confirmed" || g.status === "done")
    .reduce((sum, g) => sum + g.fee, 0);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/studio" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Studio</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">🧢 Merch Planner</h1>
      <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
        Turn your music brand into income. Plan products, work out what each one actually earns you, and track the
        drop from idea to sold out — with every sale and every production cost landing in{" "}
        <Link href="/studio/finance" className="text-[var(--accent)] underline">Revenue &amp; Budget</Link>.
      </p>

      {/* ---- How it works ---- */}
      <div className="card p-4 mt-5">
        <button
          className="flex items-center gap-2 text-sm font-semibold w-full text-left"
          onClick={() => setShowHow((v) => !v)}
          aria-expanded={showHow}
        >
          <span>How the Merch Planner works</span>
          <span className="text-[var(--muted)] ml-auto text-xs">{showHow ? "Hide" : "Show"}</span>
        </button>
        {showHow && (
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.n} className="bg-[var(--surface-2)] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {s.n}
                  </span>
                  <span className="font-semibold text-sm">{s.title}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {(note || err) && (
        <p
          className={`text-sm mt-4 ${err ? "text-[var(--brand-2)]" : "text-[var(--success)]"}`}
          aria-live="polite"
        >
          {err ?? note}
        </p>
      )}

      {/* ---- Catalogue totals ---- */}
      {merch.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <Stat label="Items planned" value={String(totals.items)} sub={`${totals.forSale} for sale now`} />
          <Stat label="Cash in stock" value={money(totals.investedCents)} sub="What your unsold stock cost you" />
          <Stat
            label="If it all sells"
            value={money(totals.potentialRevenueCents)}
            sub={`${money(totals.potentialProfitCents)} profit`}
          />
          <Stat
            label="Average margin"
            value={`${totals.avgMarginPct}%`}
            sub={totals.needsAttention > 0 ? `${totals.needsAttention} priced at or below cost` : "Aim for 50%+"}
            tone={totals.needsAttention > 0 ? "warn" : totals.avgMarginPct >= 50 ? "good" : undefined}
          />
        </div>
      )}

      {/* ---- AI planner ---- */}
      <AiPlanner ai={ai} currency={currency} onAdd={(c) => addMerchItem(c)} />

      {/* ---- Merch catalogue ---- */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-bold">Your merch</h2>
            <p className="text-xs text-[var(--muted)]">Cost and price are per unit. Stock is what you have on hand.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <label className="sr-only" htmlFor="new-merch">New merch item</label>
          <input
            id="new-merch"
            value={newMerch}
            onChange={(e) => setNewMerch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMerchItem()}
            placeholder="New item (e.g. Tour tee)"
            maxLength={120}
            className={`flex-1 min-w-0 ${inp}`}
          />
          <button className="btn btn-primary text-sm shrink-0" onClick={() => addMerchItem()}>Add</button>
        </div>

        {/* Templates: a first item with believable numbers beats an empty row. */}
        <div className="mb-4">
          <p className="text-xs text-[var(--muted)] mb-2">Or start from a costed template:</p>
          <div className="flex gap-2 flex-wrap">
            {MERCH_TEMPLATES.map((t: MerchTemplate) => (
              <button
                key={t.name}
                onClick={() =>
                  addMerchItem({
                    name: t.name,
                    cost: t.costCents,
                    price: t.priceCents,
                    stock: 0,
                    notes: t.blurb,
                  })
                }
                title={`${t.blurb} — about ${money(t.costCents)} to make, sells for ${money(t.priceCents)}`}
                className="text-xs px-2.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] transition"
              >
                {t.icon} {t.name}
                <span className="text-[var(--muted)] ml-1.5">{money(t.priceCents)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {merch.map((m) => (
            <MerchRow
              key={m.id}
              item={m}
              currency={currency}
              inp={inp}
              onPatch={(d) => patchMerch(m.id, d)}
              onDelete={() => delMerch(m.id)}
              onLogSale={() => logSale(m)}
              onLogRunCost={() => logRunCost(m)}
            />
          ))}
          {merch.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-[var(--muted)]">
                No merch planned yet. Add your first item above, or pick a template to see how the margin maths works.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---- Gigs ---- */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-1">
          <h2 className="font-bold">Shows</h2>
          {confirmedFees > 0 && (
            <span className="text-xs text-[var(--muted)]">
              {money(confirmedFees)} in confirmed &amp; played fees
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          Shows are where merch sells fastest — keep the dates here so you know what stock to bring. Tracking an
          inquiry from first contact?{" "}
          <Link href="/studio/bookings" className="text-[var(--accent)] underline">Use the Booking Scheduler</Link>.
        </p>

        <div className="flex gap-2 mb-3">
          <label className="sr-only" htmlFor="new-gig">New show</label>
          <input
            id="new-gig"
            value={newGig}
            onChange={(e) => setNewGig(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGig()}
            placeholder="New show (venue name)"
            maxLength={120}
            className={`flex-1 min-w-0 ${inp}`}
          />
          <button className="btn btn-primary text-sm shrink-0" onClick={addGig}>Add</button>
        </div>

        <div className="space-y-2">
          {gigs.map((g) => (
            <div key={g.id} className="card p-3">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={g.venue}
                  onBlur={(e) => e.target.value.trim() && patchGig(g.id, { venue: e.target.value.trim() })}
                  className={`flex-1 min-w-0 font-medium ${inp}`}
                />
                <button
                  className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)] px-2 py-1 shrink-0"
                  onClick={() => delGig(g.id)}
                  aria-label={`Delete ${g.venue}`}
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <input defaultValue={g.city} onBlur={(e) => patchGig(g.id, { city: e.target.value })} placeholder="City" className={`w-24 ${inp}`} />
                <input
                  type="date"
                  defaultValue={g.date ? g.date.slice(0, 10) : ""}
                  onChange={(e) => patchGig(g.id, { date: e.target.value ? new Date(e.target.value + "T12:00:00.000Z").toISOString() : "" })}
                  className={inp}
                />
                <select value={g.status} onChange={(e) => patchGig(g.id, { status: e.target.value })} className={`${inp} capitalize`}>
                  {GIG_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="text-xs text-[var(--muted)]">
                  Fee{" "}
                  <input
                    defaultValue={g.fee ? g.fee / 100 : ""}
                    onBlur={(e) => patchGig(g.id, { fee: toCents(e.target.value) })}
                    inputMode="decimal"
                    placeholder="0"
                    className={`w-16 ${inp}`}
                  />
                </label>
              </div>
            </div>
          ))}
          {gigs.length === 0 && <p className="text-xs text-[var(--muted)]">No shows yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-[var(--success)]" : tone === "warn" ? "text-[var(--warning)]" : "";
  return (
    <div className="card p-3.5">
      <div className="text-[11px] text-[var(--muted)] uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

/** One merch item: the editable figures plus what they mean. */
function MerchRow({
  item,
  currency,
  inp,
  onPatch,
  onDelete,
  onLogSale,
  onLogRunCost,
}: {
  item: MerchDTO;
  currency: string;
  inp: string;
  onPatch: (d: Partial<MerchDTO>) => void;
  onDelete: () => void;
  onLogSale: () => void;
  onLogRunCost: () => void;
}) {
  const money = (cents: number) => formatMoney(cents, currency);
  const e = unitEconomics(item);
  const stage = stageFor(item.status);
  const suggested = suggestPriceCents(item.cost);
  const [showNotes, setShowNotes] = useState(!!item.notes);

  return (
    <div className="card p-4">
      <div className="flex items-start gap-2">
        <input
          defaultValue={item.name}
          onBlur={(ev) => ev.target.value.trim() && onPatch({ name: ev.target.value.trim() })}
          className={`flex-1 min-w-0 font-medium ${inp}`}
          maxLength={120}
        />
        <span className={`text-[11px] px-2 py-1 rounded-full shrink-0 ${TONE_CLASS[stage.tone]}`}>{stage.label}</span>
        <button
          className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)] px-2 py-1 shrink-0"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
        >
          ✕
        </button>
      </div>

      {/* Figures */}
      <div className="flex items-end gap-3 mt-3 flex-wrap">
        <label className="text-[11px] text-[var(--muted)]">
          <span className="block mb-0.5">Cost / unit</span>
          <input
            defaultValue={item.cost ? item.cost / 100 : ""}
            onBlur={(ev) => onPatch({ cost: toCents(ev.target.value) })}
            inputMode="decimal"
            placeholder="0"
            className={`w-20 ${inp}`}
          />
        </label>
        <label className="text-[11px] text-[var(--muted)]">
          <span className="block mb-0.5">Price / unit</span>
          <input
            key={`price-${item.price}`}
            defaultValue={item.price ? item.price / 100 : ""}
            onBlur={(ev) => onPatch({ price: toCents(ev.target.value) })}
            inputMode="decimal"
            placeholder="0"
            className={`w-20 ${inp}`}
          />
        </label>
        <label className="text-[11px] text-[var(--muted)]">
          <span className="block mb-0.5">Stock</span>
          <input
            key={`stock-${item.stock}`}
            defaultValue={item.stock || ""}
            onBlur={(ev) => onPatch({ stock: Math.max(0, parseInt(ev.target.value) || 0) })}
            inputMode="numeric"
            placeholder="0"
            className={`w-16 ${inp}`}
          />
        </label>
        <label className="text-[11px] text-[var(--muted)]">
          <span className="block mb-0.5">Stage</span>
          <select value={item.status} onChange={(ev) => onPatch({ status: ev.target.value })} className={inp}>
            {MERCH_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>

        {/* Only offered when it would change something. */}
        {item.cost > 0 && suggested > 0 && item.price !== suggested && (
          <button
            className="text-xs text-[var(--accent)] underline mb-1.5"
            onClick={() => onPatch({ price: suggested })}
            title="Prices this item at a 50% margin, rounded to a .99 ending"
          >
            Suggest {money(suggested)}
          </button>
        )}
      </div>

      {/* What those figures mean */}
      <div className="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-[var(--muted)]">Profit / unit </span>
          <strong className={HEALTH_CLASS[e.health]}>
            {item.price > 0 ? money(e.marginCents) : "—"}
            {item.price > 0 && ` (${e.marginPct}%)`}
          </strong>
        </div>
        <div>
          <span className="text-[var(--muted)]">Break-even </span>
          <strong>{e.breakEvenUnits > 0 ? `${e.breakEvenUnits} units` : "—"}</strong>
        </div>
        <div>
          <span className="text-[var(--muted)]">Stock value </span>
          <strong>{money(e.potentialRevenueCents)}</strong>
        </div>
      </div>

      <p className={`text-xs mt-2 ${HEALTH_CLASS[e.health]}`}>{e.advice}</p>
      <p className="text-xs text-[var(--muted)] mt-1">
        <strong className="text-[var(--foreground)]">Next:</strong> {stage.nextStep}
      </p>

      {/* Real actions only — each one writes to the finance ledger. */}
      <div className="flex gap-2 flex-wrap mt-3">
        <button
          className="btn btn-primary text-xs px-3 py-1.5"
          onClick={onLogSale}
          disabled={item.price <= 0 || item.stock <= 0}
          title={
            item.price <= 0
              ? "Set a retail price first"
              : item.stock <= 0
                ? "No stock on hand"
                : "Logs income to Revenue & Budget and takes the units off your stock"
          }
        >
          Log a sale
        </button>
        <button
          className="btn btn-ghost text-xs px-3 py-1.5"
          onClick={onLogRunCost}
          disabled={item.cost <= 0}
          title={item.cost <= 0 ? "Set a unit cost first" : "Books what the production run cost as an expense"}
        >
          Log run cost
        </button>
        <button className="btn btn-ghost text-xs px-3 py-1.5" onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? "Hide notes" : "Notes"}
        </button>
      </div>

      {showNotes && (
        <textarea
          defaultValue={item.notes}
          onBlur={(ev) => onPatch({ notes: ev.target.value })}
          placeholder="Supplier, sizes, print details, launch date…"
          maxLength={2000}
          rows={3}
          className={`w-full mt-2 ${inp}`}
        />
      )}
    </div>
  );
}

/** The AI concept generator. Pro and Premium; Free sees what it unlocks. */
function AiPlanner({
  ai,
  currency,
  onAdd,
}: {
  ai: { limit: number; used: number; remaining: number; campaigns: boolean; plan: "free" | "pro" | "premium" };
  currency: string;
  onAdd: (concept: { name: string; cost: number; price: number; stock: number; notes: string }) => void;
}) {
  const money = (cents: number) => formatMoney(cents, currency);
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [wantCampaign, setWantCampaign] = useState(ai.campaigns);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MerchPlanResult | null>(null);
  const [remaining, setRemaining] = useState(ai.remaining);
  const [error, setError] = useState<string | null>(null);

  // Free plan: say exactly what the upgrade buys, and nothing that looks
  // clickable but isn't.
  if (ai.limit <= 0) {
    return (
      <div className="card p-5 mt-5 border-[var(--brand)]">
        <h2 className="font-semibold flex items-center gap-2">✨ AI merch concepts <span className="text-[10px] uppercase tracking-wider bg-[var(--brand)] text-white px-1.5 py-0.5 rounded-full">Pro</span></h2>
        <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
          Everything else on this page is free. Pro adds the hard part: product ideas built around your genre,
          your audience size and your budget — each one costed, priced to a 50% margin, with a realistic first-run
          quantity and the posts to sell it. Premium adds a week-by-week launch campaign.
        </p>
        <Link href="/pricing" className="btn btn-primary mt-3 inline-flex">See Pro plans</Link>
      </div>
    );
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/merch-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(brief.trim() ? { brief: brief.trim() } : {}),
          ...(budget.trim() ? { budgetCents: toCents(budget) } : {}),
          campaign: wantCampaign && ai.campaigns,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not generate a plan. Try again.");
        return;
      }
      setResult(data.plan as MerchPlanResult);
      if (data.quota?.remaining !== undefined) setRemaining(data.quota.remaining);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 mt-5">
      <div className="flex items-start gap-2 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2">
          ✨ AI merch planner
          {ai.campaigns && (
            <span className="text-[10px] uppercase tracking-wider bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded-full">
              Premium
            </span>
          )}
        </h2>
        <span className="text-xs text-[var(--muted)] sm:ml-auto">
          {remaining} of {ai.limit} plans left today
        </span>
      </div>
      <p className="text-sm text-[var(--muted)] mt-1.5">
        Describe what you have in mind — or leave it blank and let it propose what fits your genre, audience and
        budget. Every concept comes costed and priced; add the ones you like straight to your catalogue.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-3">
        <label className="sr-only" htmlFor="merch-brief">What do you have in mind?</label>
        <input
          id="merch-brief"
          value={brief}
          onChange={(ev) => setBrief(ev.target.value)}
          placeholder="Optional: e.g. something for my album launch, under $15 to make"
          maxLength={500}
          className="input text-sm min-w-0"
        />
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          Budget
          <input
            value={budget}
            onChange={(ev) => setBudget(ev.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="input text-sm w-24"
            aria-label="First-run budget"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        <button className="btn btn-primary text-sm" onClick={generate} disabled={loading || remaining <= 0}>
          {loading ? "Thinking…" : remaining <= 0 ? "No plans left today" : "Generate concepts"}
        </button>
        {ai.campaigns ? (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={wantCampaign} onChange={(ev) => setWantCampaign(ev.target.checked)} />
            Include a week-by-week launch campaign
          </label>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            Premium also writes the week-by-week launch campaign.{" "}
            <Link href="/pricing" className="text-[var(--accent)] underline">Compare plans</Link>
          </span>
        )}
      </div>

      {error && <p className="text-xs text-[var(--brand-2)] mt-2">{error}</p>}

      {result && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <p className="text-sm leading-relaxed">{result.strategy}</p>

          <div className="grid gap-3 md:grid-cols-2">
            {result.concepts.map((c) => {
              const margin = c.suggestedPriceCents - c.suggestedCostCents;
              const pct = c.suggestedPriceCents > 0 ? Math.round((margin / c.suggestedPriceCents) * 100) : 0;
              return (
                <div key={c.name} className="bg-[var(--surface-2)] rounded-lg p-4">
                  <h3 className="font-semibold text-sm">{c.name}</h3>
                  <p className="text-xs text-[var(--muted)] mt-1">{c.what}</p>
                  <p className="text-xs mt-2"><strong>Why it fits:</strong> {c.why}</p>
                  {c.audience && <p className="text-xs text-[var(--muted)] mt-1"><strong className="text-[var(--foreground)]">Who buys it:</strong> {c.audience}</p>}
                  <div className="text-xs mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-[var(--muted)]">Make for <strong className="text-[var(--foreground)]">{money(c.suggestedCostCents)}</strong></span>
                    <span className="text-[var(--muted)]">Sell at <strong className="text-[var(--foreground)]">{money(c.suggestedPriceCents)}</strong></span>
                    <span className="text-[var(--success)]">{money(margin)} profit ({pct}%)</span>
                    {c.firstRunUnits > 0 && <span className="text-[var(--muted)]">First run <strong className="text-[var(--foreground)]">{c.firstRunUnits}</strong></span>}
                  </div>
                  {c.promoAngles.length > 0 && (
                    <ul className="text-xs text-[var(--muted)] mt-2.5 space-y-1">
                      {c.promoAngles.map((p, i) => (
                        <li key={i} className="flex gap-1.5"><span className="text-[var(--accent)]">→</span><span>{p}</span></li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="btn btn-ghost text-xs px-3 py-1.5 mt-3"
                    onClick={() =>
                      onAdd({
                        name: c.name,
                        cost: c.suggestedCostCents,
                        price: c.suggestedPriceCents,
                        stock: 0,
                        notes: [c.what, c.why, ...c.promoAngles].filter(Boolean).join("\n\n").slice(0, 2000),
                      })
                    }
                  >
                    Add to my merch
                  </button>
                </div>
              );
            })}
          </div>

          {result.pricingNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1.5">Pricing notes</h3>
              <ul className="text-xs text-[var(--muted)] space-y-1">
                {result.pricingNotes.map((n, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-[var(--warning)]">•</span><span>{n}</span></li>
                ))}
              </ul>
            </div>
          )}

          {result.campaign && result.campaign.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Launch campaign</h3>
              <div className="space-y-2">
                {result.campaign.map((w, i) => (
                  <div key={i} className="bg-[var(--surface-2)] rounded-lg p-3.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-[var(--brand)] uppercase tracking-wide">{w.week}</span>
                      <span className="text-sm font-semibold">{w.focus}</span>
                    </div>
                    <ul className="text-xs text-[var(--muted)] mt-1.5 space-y-1">
                      {w.actions.map((a, ai2) => (
                        <li key={ai2} className="flex gap-1.5"><span className="text-[var(--accent)]">○</span><span>{a}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
