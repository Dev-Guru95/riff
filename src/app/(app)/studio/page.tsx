import Link from "next/link";
import { BUILDERS } from "@/lib/studio";

export const metadata = { title: "Studio — Riff" };

const AI_TOOLS = [
  { href: "/studio/caption", icon: "✍️", name: "Caption & Hashtag Generator", track: 2, tagline: "Generate scroll-stopping captions and hashtags." },
];

const MANAGERS = [
  { href: "/studio/brand-kit", icon: "🪪", name: "Brand Kit", track: 1, tagline: "Palette, fonts, logos & brand guidelines in one place." },
  { href: "/studio/fans", icon: "👥", name: "Fan CRM", track: 5, tagline: "Your audience, tagged into targetable segments." },
  { href: "/studio/broadcasts", icon: "📣", name: "Broadcasts", track: 5, tagline: "Compose fan updates and target them by segment." },
  { href: "/studio/link-in-bio", icon: "🔗", name: "Link-in-Bio", track: 5, tagline: "A public landing page for all your links." },
  { href: "/studio/finance", icon: "💰", name: "Revenue & Budget", track: 6, tagline: "Track what your music earns and costs." },
  { href: "/studio/merch", icon: "🧢", name: "Merch & Gigs", track: 6, tagline: "Plan your merch drops and track your shows." },
  { href: "/studio/bookings", icon: "📆", name: "Booking Scheduler", track: 7, tagline: "Track show inquiries from first contact to confirmed." },
  { href: "/studio/goals", icon: "🎯", name: "Goals & Milestones", track: 8, tagline: "Set career goals and track milestone progress." },
];

export default function StudioPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">🎛️ Studio</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Do the real work and get instant, AI-scored feedback — without leaving Riff.
      </p>

      <Link href="/studio/dashboard" className="card p-4 flex items-center gap-3 hover:border-[var(--brand)] transition group mb-6">
        <span className="text-2xl">📊</span>
        <div>
          <div className="font-semibold group-hover:text-[var(--brand)] transition">Career Dashboard</div>
          <p className="text-xs text-[var(--muted)]">Your whole career at a glance — XP, revenue, fans, goals, tasks.</p>
        </div>
      </Link>

      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">AI tools</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...BUILDERS.map((b) => ({ href: `/studio/${b.kind}`, icon: b.icon, name: b.name, track: b.track, tagline: b.tagline })), ...AI_TOOLS].map((t) => (
          <Link key={t.href} href={t.href} className="card p-4 hover:border-[var(--brand)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t.icon}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">Track {t.track}</span>
            </div>
            <div className="font-semibold mt-1 group-hover:text-[var(--brand)] transition">{t.name}</div>
            <p className="text-xs text-[var(--muted)] mt-0.5">{t.tagline}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-[var(--muted)] mt-8 mb-3">Your assets & business</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MANAGERS.map((t) => (
          <Link key={t.href} href={t.href} className="card p-4 hover:border-[var(--brand)] transition group">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t.icon}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--muted)]">Track {t.track}</span>
            </div>
            <div className="font-semibold mt-1 group-hover:text-[var(--brand)] transition">{t.name}</div>
            <p className="text-xs text-[var(--muted)] mt-0.5">{t.tagline}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-[var(--muted)] mt-8 mb-3">Project boards</h2>
      <Link href="/boards" className="card p-4 flex items-center gap-3 hover:border-[var(--brand)] transition group">
        <span className="text-2xl">🗂️</span>
        <div>
          <div className="font-semibold group-hover:text-[var(--brand)] transition">Open Projects</div>
          <p className="text-xs text-[var(--muted)]">Content Calendar · Release Planner · Pitch Tracker · Outreach CRM · Collaboration Board</p>
        </div>
      </Link>
    </main>
  );
}
