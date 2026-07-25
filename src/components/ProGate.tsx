import { SKOOL_URL } from "@/lib/constants";

// Locked screen for Pro-only features (AI coach, Community). Free-app users who
// tap one of these are told it's a Pro feature and sent to join the Skool
// community, which is where Pro access lives.
export function ProGate({ feature, icon, blurb }: { feature: string; icon: string; blurb: string }) {
  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)] mb-2">
        Available on Skool
      </span>
      <h1 className="text-2xl font-bold mb-3">{feature} is available on Skool</h1>
      <p className="text-sm text-[var(--muted)] mb-8">{blurb}</p>
      <a
        href={SKOOL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-lg bg-[var(--brand)] text-white font-semibold py-3 px-6 hover:opacity-90 transition"
      >
        Join the Skool community to unlock →
      </a>
      <p className="text-xs text-[var(--muted)] mt-4">
        Everything else in the app stays free — courses, missions, audits, and leaderboards.
      </p>
    </main>
  );
}
