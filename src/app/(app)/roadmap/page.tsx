import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoadmapClient } from "./RoadmapClient";

export default async function RoadmapPage() {
  const session = (await getSession())!;
  const roadmaps = await prisma.roadmap.findMany({
    where: { userId: session.id, isCurrent: true },
    orderBy: { createdAt: "desc" },
  });
  const byHorizon: Record<string, { plan: string }> = {};
  roadmaps.forEach((r) => (byHorizon[r.horizon] = { plan: r.plan }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">🧭 AI Career Roadmap</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Personalized growth plans based on your goals, genre, audience, and performance.
      </p>
      <RoadmapClient
        initial={Object.fromEntries(Object.entries(byHorizon).map(([h, v]) => [h, JSON.parse(v.plan)]))}
      />
    </main>
  );
}
