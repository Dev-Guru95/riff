import { badgeAsset } from "@/lib/assets";

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-track h-2 w-full">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function ProgressRing({ pct, size = 64, label }: { pct: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, pct) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--brand)"
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold">{label ?? `${pct}%`}</span>
    </div>
  );
}

export function Stat({ icon, value, label }: { icon: string; value: React.ReactNode; label: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="text-xs text-[var(--muted)] mt-1">{label}</div>
      </div>
    </div>
  );
}

export function Badge({ badgeKey, icon, name, dim }: { badgeKey?: string; icon: string; name: string; dim?: boolean }) {
  return (
    <div
      className={`card px-3 py-2 flex items-center gap-2 ${dim ? "opacity-40 grayscale" : ""}`}
      title={name}
    >
      {badgeKey ? (
        // Placeholder art from public/badges — swap the file to reskin (see src/lib/assets.ts).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={badgeAsset(badgeKey)} alt="" width={28} height={28} className="shrink-0" />
      ) : (
        <span className="text-lg">{icon}</span>
      )}
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}
