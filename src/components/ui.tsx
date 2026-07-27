import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";
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

export function TopNav({ email, isAdmin }: { email?: string; isAdmin?: boolean }) {
  return (
    <nav className="border-b border-[var(--border)] sticky top-0 z-20 bg-[var(--background)]/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
          <span className="text-[var(--brand)]">●</span> Riff
        </Link>
        <div className="flex items-center gap-0.5 text-sm flex-wrap justify-end">
          <NavLink href="/dashboard">Home</NavLink>
          <NavLink href="/courses">Courses</NavLink>
          <NavLink href="/coach">Coach</NavLink>
          <NavLink href="/missions">Missions</NavLink>
          <NavLink href="/studio">Studio</NavLink>
          <NavLink href="/boards">Projects</NavLink>
          <NavLink href="/audit">Audit</NavLink>
          <NavLink href="/roadmap">Roadmap</NavLink>
          <NavLink href="/community">Community</NavLink>
          <NavLink href="/leaderboard">Ranks</NavLink>
          <NavLink href="/pricing">Plans</NavLink>
          {isAdmin && <NavLink href="/admin">Admin</NavLink>}
          {email && <NotificationBell />}
          {email ? (
            <span className="ml-2">
              <LogoutButton />
            </span>
          ) : (
            <NavLink href="/login">Log in</NavLink>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-1.5 rounded-lg hover:bg-[var(--surface-2)] transition">
      {children}
    </Link>
  );
}
