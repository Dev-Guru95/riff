"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Account = { id: string; platform: string; handle: string; connectVia: string };
type Report = {
  marketingScore: number;
  brandingScore: number;
  growthScore: number;
  consistencyScore: number;
  deltas: Record<string, number>;
  recommendations: string[];
  createdAt: string;
};

const PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: "📷" },
  { key: "tiktok", label: "TikTok", icon: "🎵" },
  { key: "youtube", label: "YouTube", icon: "▶️" },
  { key: "facebook", label: "Facebook", icon: "👍" },
  { key: "x", label: "X", icon: "✖️" },
  { key: "spotify", label: "Spotify for Artists", icon: "🎧" },
];

export function AuditClient({
  accounts,
  report,
  runCount,
  oauthProviders,
  plan,
  connectionLimit,
}: {
  accounts: Account[];
  report: Report | null;
  runCount: number;
  oauthProviders: string[];
  plan: string;
  connectionLimit: number;
}) {
  const router = useRouter();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [running, setRunning] = useState(false);
  const connected = new Set(accounts.map((a) => a.platform));
  const atLimit = connected.size >= connectionLimit;

  async function connect(platform: string) {
    if (!handle.trim()) return;
    await fetch("/api/social/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platform, handle: handle.replace(/^@/, "") }),
    });
    setConnecting(null);
    setHandle("");
    router.refresh();
  }

  async function disconnect(platform: string) {
    await fetch(`/api/social/connect?platform=${platform}`, { method: "DELETE" });
    router.refresh();
  }

  async function runAudit() {
    setRunning(true);
    const res = await fetch("/api/audit/run", { method: "POST" });
    setRunning(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Could not run audit"); }
  }

  return (
    <div className="space-y-6">
      {/* Connections */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Connected accounts</h2>
        {/* The Plans page states this limit; the Audit screen used to show six
            Connect buttons and let people discover it by hitting the error. */}
        <p className="text-xs text-[var(--muted)] mb-3">
          {atLimit ? (
            <>
              You&apos;ve used all {connectionLimit} connection{connectionLimit === 1 ? "" : "s"} on your{" "}
              <span className="capitalize">{plan}</span> plan.{" "}
              {plan === "free" && <Link href="/pricing" className="text-[var(--accent)] underline">Upgrade to connect all six</Link>}
            </>
          ) : (
            <>
              Your <span className="capitalize">{plan}</span> plan includes {connectionLimit} connected account
              {connectionLimit === 1 ? "" : "s"} — {connected.size} of {connectionLimit} used.
              {plan === "free" && (
                <>
                  {" "}
                  <Link href="/pricing" className="text-[var(--accent)] underline">Pro connects all six.</Link>
                </>
              )}
            </>
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p.key);
            return (
              <div key={p.key} className="flex items-center justify-between border border-[var(--border)] rounded-lg px-3 py-2">
                <span className="text-sm flex items-center gap-2"><span>{p.icon}</span>{p.label}</span>
                {acc ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-[var(--success)]">{acc.connectVia === "oauth" ? "🔗 connected" : `@${acc.handle}`}</span>
                    <button className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={() => disconnect(p.key)}>✕</button>
                  </span>
                ) : atLimit ? (
                  <span className="text-xs text-[var(--muted)]">🔒 Plan limit</span>
                ) : oauthProviders.includes(p.key) ? (
                  <a href={`/api/social/oauth/${p.key}/start`} className="text-xs btn btn-primary py-1 px-3">Connect</a>
                ) : connecting === p.key ? (
                  <span className="flex items-center gap-1">
                    <input autoFocus className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-xs w-24 outline-none" placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connect(p.key)} />
                    <button className="text-xs btn btn-primary py-1 px-2" onClick={() => connect(p.key)}>Add</button>
                  </span>
                ) : (
                  <button className="text-xs btn btn-ghost py-1 px-3" onClick={() => setConnecting(p.key)}>Connect</button>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn btn-primary w-full mt-4" onClick={runAudit} disabled={running || connected.size === 0}>
          {running ? "Analyzing your accounts…" : runCount > 0 ? "Run this month's audit" : "Run my first audit"}
        </button>
        {connected.size === 0 && <p className="text-xs text-[var(--muted)] mt-2 text-center">Connect at least one account to run an audit.</p>}
      </section>

      {/* Example. Before the first run the screen was a wall of Connect buttons
          and a disabled button, so there was nothing showing what an audit is
          worth. Clearly labelled so it is never mistaken for real scores. */}
      {!report && (
        <section className="card p-5 border-dashed">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">What you&apos;ll get</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">Example</span>
          </div>
          <div className="grid grid-cols-2 gap-3 opacity-80">
            <ScoreCard label="Marketing" score={72} delta={6} />
            <ScoreCard label="Branding" score={64} delta={-3} />
            <ScoreCard label="Growth" score={58} delta={12} />
            <ScoreCard label="Consistency" score={81} delta={4} />
          </div>
          <ul className="space-y-2 mt-4">
            {[
              "You post consistently on TikTok but go quiet on Instagram for 9 days at a time — mirror your three best TikToks as Reels this week.",
              "Your bio names your genre but not your city. Add it: local listeners and playlist curators search that way.",
              "Growth is up 12% but saves are flat — try one post that teaches something about how you make your music.",
            ].map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><span className="text-[var(--accent)] mt-0.5">→</span><span>{r}</span></li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)] mt-4">
            Connect an account above to get your own scores. Audits build month over month, so the first run is your baseline.
          </p>
        </section>
      )}

      {/* Scores */}
      {report && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <ScoreCard label="Marketing" score={report.marketingScore} delta={report.deltas.marketing} />
            <ScoreCard label="Branding" score={report.brandingScore} delta={report.deltas.branding} />
            <ScoreCard label="Growth" score={report.growthScore} delta={report.deltas.growth} />
            <ScoreCard label="Consistency" score={report.consistencyScore} delta={report.deltas.consistency} />
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">Recommendations</h2>
            <ul className="space-y-2">
              {report.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><span className="text-[var(--accent)] mt-0.5">→</span><span>{r}</span></li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)] mt-4">Last run {new Date(report.createdAt).toLocaleDateString()} · audits build month over month.</p>
          </section>
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, score, delta }: { label: string; score: number; delta?: number }) {
  const color = score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--brand-2)";
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        {delta != null && delta !== 0 && (
          <span className={`text-xs ${delta > 0 ? "text-[var(--success)]" : "text-[var(--brand-2)]"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="text-3xl font-extrabold mt-1" style={{ color }}>{score}</div>
      <div className="progress-track h-1.5 mt-2"><div className="progress-fill" style={{ width: `${score}%` }} /></div>
    </div>
  );
}
