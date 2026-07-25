import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex-1">
      <nav className="border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg flex items-center gap-2">
            <span className="text-[var(--brand)]">●</span> Riff
          </span>
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-ghost">Log in</Link>
            <Link href="/signup" className="btn btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-block text-xs font-semibold text-[var(--accent)] bg-[var(--surface-2)] px-3 py-1 rounded-full mb-6">
          AI-powered artist education
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
          Learn the{" "}
          <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] bg-clip-text text-transparent">
            business
          </span>{" "}
          behind the music.
        </h1>
        <p className="text-lg text-[var(--muted)] mt-6 max-w-xl mx-auto">
          Master marketing, branding, fan growth, and release strategy through gamified courses,
          AI-graded assignments, and a personal AI coach that tracks your real growth.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link href="/signup" className="btn btn-primary px-6 py-3 text-base">Start free</Link>
          <Link href="/login" className="btn btn-ghost px-6 py-3 text-base">I have an account</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24 grid sm:grid-cols-3 gap-4">
        {[
          { icon: "🎯", title: "Structured courses", body: "Modules → lessons → quizzes → assignments. Unlock as you grow." },
          { icon: "🔥", title: "Gamified progress", body: "XP, badges, streaks, levels from Beginner Artist to Music Entrepreneur." },
          { icon: "🤖", title: "AI assignment review", body: "Submit work, get a 0–100 score with strengths, gaps, and next actions." },
          { icon: "📈", title: "Social audits", body: "Connect your platforms and track marketing, branding & growth scores." },
          { icon: "🧭", title: "AI career roadmap", body: "Personalized 30/90-day & 6/12-month growth plans." },
          { icon: "🏆", title: "Leaderboards", body: "Compete globally, by country, and by genre. Top ranks earn rewards." },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-[var(--muted)]">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
