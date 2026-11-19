"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCouponForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [type, setType] = useState("percent");
  const [value, setValue] = useState(20);
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMax] = useState(0);
  // Which paid plans a discount applies to (none ticked = all of them), and
  // how long access lasts when a code covers the whole price.
  const [plans, setPlans] = useState<string[]>([]);
  const [durationMonths, setDuration] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, type, value, description, maxRedemptions, plans, durationMonths }),
    });
    setLoading(false);
    if (res.ok) { setCode(""); setDescription(""); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Failed"); }
  }

  return (
    <form onSubmit={submit} className="card p-4 grid sm:grid-cols-[1fr_1fr_6rem_6rem_1fr_auto] gap-2 items-end">
      <Field label="Code"><input className="ci" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER25" /></Field>
      <Field label="Type">
        <select className="ci" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="percent">percent</option><option value="fixed">fixed</option><option value="reward">reward</option>
        </select>
      </Field>
      <Field label="Value"><input type="number" className="ci" value={value} onChange={(e) => setValue(Number(e.target.value))} /></Field>
      {/* Without this field the value stayed at its initial 0, so every coupon
          was created unlimited no matter what the admin intended. */}
      <Field label="Max uses"><input type="number" min={0} className="ci" value={maxRedemptions} onChange={(e) => setMax(Math.max(0, Number(e.target.value) || 0))} title="0 = unlimited" /></Field>
      <Field label="Description"><input className="ci" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <button className="btn btn-primary" disabled={loading || !code}>Create</button>

      {/* Billing scope. Only meaningful for percent/fixed codes — a `reward`
          code is redeemed on the leaderboard and never touches a price. */}
      {type !== "reward" && (
        <div className="col-span-full flex flex-wrap items-end gap-4 pt-1">
          <fieldset className="flex items-center gap-3">
            <legend className="sr-only">Applies to</legend>
            <span className="text-xs text-[var(--muted)]">Applies to</span>
            {(["pro"] as const).map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={plans.includes(p)}
                  onChange={(e) => setPlans((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))}
                />
                {p}
              </label>
            ))}
            <span className="text-xs text-[var(--muted)]">{plans.length === 0 ? "(all paid plans)" : ""}</span>
          </fieldset>
          <label className="block">
            <span className="text-xs text-[var(--muted)] mb-1 block">Free months (100% codes)</span>
            <input
              type="number"
              min={0}
              className="ci w-28"
              value={durationMonths}
              onChange={(e) => setDuration(Math.max(0, Number(e.target.value) || 0))}
              title="How long access lasts when the code covers the whole price. 0 = no end date."
            />
          </label>
          <p className="text-xs text-[var(--muted)] flex-1 min-w-[14rem]">
            A <strong>percent</strong> code of <strong>100</strong> takes the price to zero: the artist activates the
            plan without paying, on the website or in the app. Anything less is charged through Stripe.
          </p>
        </div>
      )}
      {err && <p className="text-sm text-[var(--brand-2)] col-span-full">{err}</p>}
      <style>{`.ci{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:.5rem;padding:.5rem .6rem;font-size:.85rem;color:var(--foreground);outline:none}.ci:focus{border-color:var(--brand)}`}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-[var(--muted)] mb-1 block">{label}</span>{children}</label>;
}

export function IssueRewardsButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function issue() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/admin/rewards/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topN: 1000, code: "TOP1000" }),
    });
    const d = await res.json();
    setLoading(false);
    setMsg(res.ok ? `Snapshotted ${d.ranked} artists · rewarded top ${d.rewarded} · ${d.notified} notified (period ${d.period}).` : d.error ?? "Failed");
  }
  return (
    <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="font-semibold text-sm">Issue Top-1000 leaderboard rewards</div>
        <div className="text-xs text-[var(--muted)]">Snapshots the global board and notifies qualifying artists with the reward code.</div>
        {msg && <div className="text-xs text-[var(--accent)] mt-1">{msg}</div>}
      </div>
      <button className="btn btn-primary" onClick={issue} disabled={loading}>{loading ? "Issuing…" : "Issue rewards"}</button>
    </div>
  );
}
