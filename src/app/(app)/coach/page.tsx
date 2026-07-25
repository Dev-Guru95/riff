import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSkoolMember } from "@/lib/community";
import { CoachChat } from "./CoachChat";

// AI Coach is a community-gated Pro feature: available once the artist joins the
// Skool community. Non-members are routed to the community onboarding.
export default async function CoachPage() {
  const session = (await getSession())!;
  if (!(await isSkoolMember(session.id))) redirect("/community");

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
