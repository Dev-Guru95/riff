import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { getMissionsForUser } from "@/lib/missions";
import { getEntitlements } from "@/lib/entitlements";
import { MissionCard } from "./MissionsClient";

export default async function MissionsPage() {
  const session = await requirePageSession();
  const [missions, { weeklyMissions }] = await Promise.all([
    getMissionsForUser(session.id),
    getEntitlements(session.id),
  ]);
  const completed = missions.filter((m) => m.status === "completed").length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">🎯 Weekly Missions</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Real-world challenges that grow your career. Complete them for XP, badges, and leaderboard points.
        {weeklyMissions && (
          <span className="text-[var(--foreground)] font-medium"> {completed}/{missions.length} done.</span>
        )}
      </p>

      {/* Missions stay visible on Free so the value is obvious, but they cannot
          be completed — the Plans page lists them under Pro. */}
      {!weeklyMissions && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold mb-1">🔒 Missions are part of Pro</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            Weekly missions turn what you learn into real career steps, and they count towards your XP, badges and
            leaderboard rank. Upgrade to start completing them.
          </p>
          <Link href="/pricing" className="btn btn-primary">See plans</Link>
        </div>
      )}

      <div className="space-y-3">
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} locked={!weeklyMissions} />
        ))}
        {missions.length === 0 && (
          <p className="text-[var(--muted)] text-sm">No active missions right now. Check back soon!</p>
        )}
      </div>
    </main>
  );
}
