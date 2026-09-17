import Link from "next/link";
import { badgeAsset } from "@/lib/assets";
import { Icon, type IconName } from "./icons";

// Shared presentational primitives. Deliberately free of hooks and "use client"
// so Server Components can render them directly.

/** Page title + supporting line, with an optional action on the right. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Back link above a page title, e.g. "‹ Studio". */
export function Breadcrumb({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition mb-1"
    >
      <Icon name="chevronLeft" size={14} />
      {label}
    </Link>
  );
}

/**
 * Metric tile: large value, muted label beneath, line icon in the top-right.
 * Replaces the icon-left `Stat` on redesigned screens; `Stat` stays exported
 * for the pages that have not been migrated.
 */
export function StatCard({
  value,
  label,
  icon,
  href,
}: {
  value: React.ReactNode;
  label: string;
  icon?: IconName;
  href?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none truncate">{value}</div>
        <div className="text-xs text-[var(--muted)] mt-1.5">{label}</div>
      </div>
      {icon && <Icon name={icon} size={18} className="text-[var(--muted)] shrink-0" />}
    </>
  );
  const cls = "card p-4 flex items-start justify-between gap-3";
  return href ? (
    <Link href={href} className={`${cls} hover:border-[var(--brand)] transition`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Labelled gradient progress row with the percentage trailing the bar. */
export function GoalBar({ label, pct }: { label: React.ReactNode; pct: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div>
      {label && <div className="text-sm mb-1.5">{label}</div>}
      <div className="flex items-center gap-3">
        <div className="progress-track h-1.5 flex-1">
          <div className="progress-fill" style={{ width: `${safe}%` }} />
        </div>
        <span className="text-xs text-[var(--muted)] tabular-nums w-9 text-right shrink-0">{safe}%</span>
      </div>
    </div>
  );
}

/** Status / tag label. */
export function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "success" | "warning" | "danger" | "brand";
}) {
  const tones: Record<string, string> = {
    muted: "",
    success: "text-[var(--success)] border-[var(--success)]/40",
    warning: "text-[var(--warning)] border-[var(--warning)]/40",
    danger: "text-[var(--brand-2)] border-[var(--brand-2)]/40",
    brand: "text-[var(--brand)] border-[var(--brand)]/40",
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

/** Line-art placeholder for a list with nothing in it. */
export function EmptyState({
  icon = "cactus",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <Icon name={icon} size={40} className="text-[var(--muted)] mb-3" strokeWidth={1.25} />
      <p className="text-sm text-[var(--muted)]">{title}</p>
      {hint && <p className="text-xs text-[var(--muted)] mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Circle (or rounded-square) avatar that falls back to initials. */
export function Avatar({
  name,
  size = 32,
  square,
}: {
  name: string;
  size?: number;
  square?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)] font-semibold ${
        square ? "rounded-lg" : "rounded-full"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}

/** Card wrapper for a table; clips the rows to the rounded corners. */
export function TableCard({ children }: { children: React.ReactNode }) {
  return <div className="card overflow-hidden">{children}</div>;
}

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
