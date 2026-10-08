import Link from "next/link";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommunityStatus } from "@/lib/community";
import { CoachChat } from "./CoachChat";

// AI Coach is a community-gated Pro feature: available once the artist joins the
// Skool community. Non-members see a locked state here rather than being
// redirected — a redirect to /community lit up the wrong sidebar item and read
// as a broken link.
export default async function CoachPage() {
  const session = await requirePageSession();
  const status = await getCommunityStatus(session.id);
  if (status !== "member") return <CoachLocked pending={status === "pending"} />;

  // Use the most recent thread, or create one.
  let thread = await prisma.coachThread.findFirst({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) {
    const created = await prisma.coachThread.create({ data: { userId: session.id } });
    thread = { ...created, messages: [] };
  }

  const profile = await prisma.artistProfile.findUnique({ where: { userId: session.id } });

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-3.5rem)]">
      <header className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">🤖 AI Artist Coach</h1>
        <p className="text-sm text-[var(--muted)]">
          Personalized to {profile?.stageName ?? "you"} — knows your goals, genre, progress, and audit scores.
        </p>
      </header>
      <CoachChat
        threadId={thread.id}
        initialMessages={thread.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      />
    </main>
  );
}

function CoachLocked({ pending }: { pending: boolean }) {
  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-2xl font-bold">AI Artist Coach</h1>
      <p className="text-[var(--muted)] mt-2">
        A coach that knows your goals, genre, progress and audit scores. It unlocks when you join the
        SoundRig community on Skool.
      </p>
      {pending ? (
        <p className="text-sm mt-6">
          ⏳ Your membership is being verified — your coach unlocks as soon as it&apos;s approved.
        </p>
      ) : (
        <Link href="/community" className="btn btn-primary mt-6 inline-block">
          Join the community to unlock
        </Link>
      )}
    </main>
  );
}
