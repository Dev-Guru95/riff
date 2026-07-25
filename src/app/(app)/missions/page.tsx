import { getSession } from "@/lib/auth";
import { getMissionsForUser } from "@/lib/missions";
import { MissionCard } from "./MissionsClient";

export default async function MissionsPage() {
  const session = (await getSession())!;
  const missions = await getMissionsForUser(session.id);
  const completed = missions.filter((m) => m.status === "completed").length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">🎯 Weekly Missions</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Real-world challenges that grow your career. Complete them for XP, badges, and leaderboard points.
        <span className="text-[var(--foreground)] font-medium"> {completed}/{missions.length} done.</span>
      </p>

      <div className="space-y-3">
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
        {missions.length === 0 && <p className="text-[var(--muted)] text-sm">No active missions right now. Check back soon!</p>}
      </div>
    </main>
  );
}
