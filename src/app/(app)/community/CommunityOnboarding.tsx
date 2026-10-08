"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKOOL_URL } from "@/lib/constants";

const BENEFITS: { icon: string; title: string; body: string }[] = [
  { icon: "🤖", title: "AI Coach", body: "Your personal mentor — unlocks once you're verified." },
  { icon: "💬", title: "Student discussions", body: "Ask, answer, and learn with other artists." },
  { icon: "🤝", title: "Accountability groups", body: "Stay consistent with a crew that shows up." },
  { icon: "🏆", title: "Weekly leaderboards", body: "Compete and climb every single week." },
  { icon: "📊", title: "Monthly rankings", body: "See how far you've come, month over month." },
  { icon: "🎯", title: "Challenges", body: "Real-world missions with real rewards." },
  { icon: "📣", title: "Announcements", body: "Never miss drops, updates, or opportunities." },
  { icon: "🎬", title: "Live events", body: "Workshops, Q&As, and guest sessions." },
  { icon: "🌍", title: "Networking", body: "Meet collaborators, peers, and mentors." },
  { icon: "🎁", title: "Exclusive rewards", body: "Perks reserved for community members." },
  { icon: "💚", title: "Community support", body: "Encouragement when you need it most." },
];

export function CommunityOnboarding({ alreadyRequested }: { alreadyRequested: boolean }) {
  const router = useRouter();
  // intro -> (open Skool) -> confirm -> (request) -> pending
  const [stage, setStage] = useState<"intro" | "confirm" | "pending">(
    alreadyRequested ? "pending" : "intro",
  );
  const [loading, setLoading] = useState(false);

  function openSkool() {
    window.open(SKOOL_URL, "_blank", "noopener,noreferrer");
    setStage("confirm");
  }

  async function requestAccess() {
    setLoading(true);
    const res = await fetch("/api/community/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(false);
    if (res.ok) {
      setStage("pending");
      router.refresh();
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🤝</div>
        <h1 className="text-3xl font-bold">Join the SoundRig Community</h1>
        <p className="text-[var(--muted)] mt-2 max-w-lg mx-auto">
          Riff is SoundRig’s learning app — lessons, quizzes and tools live here. The SoundRig
          community lives on Skool — join to unlock your AI Coach, accountability, challenges, live
          events, and the people who’ll keep you moving.
        </p>
      </div>

      {/* Benefits */}
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {BENEFITS.map((b) => (
          <div key={b.title} className="card p-4 flex items-start gap-3">
            <span className="text-2xl">{b.icon}</span>
            <div>
              <div className="font-semibold text-sm">{b.title}</div>
              <div className="text-xs text-[var(--muted)]">{b.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="card p-6 text-center sticky bottom-4">
        {stage === "intro" && (
          <>
            <h2 className="text-lg font-bold mb-1">Ready to plug in?</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Join free on Skool, then request access here. Our team verifies your membership before
              unlocking Community + AI Coach.
            </p>
            <button className="btn btn-primary w-full py-3 text-base" onClick={openSkool}>
              Join the Community on Skool →
            </button>
          </>
        )}

        {stage === "confirm" && (
          <>
            <h2 className="text-lg font-bold mb-1">Joined on Skool?</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Request access below. An admin will verify your Skool membership, then Community + AI
              Coach unlock automatically.
            </p>
            <button className="btn btn-primary w-full py-3 text-base" disabled={loading} onClick={requestAccess}>
              {loading ? "Sending…" : "Request access"}
            </button>
            <button className="btn btn-ghost w-full py-2 mt-2 text-sm" onClick={openSkool}>
              Re-open Skool
            </button>
          </>
        )}

        {stage === "pending" && (
          <>
            <div className="text-4xl mb-2">⏳</div>
            <h2 className="text-lg font-bold mb-1">Request received</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Thanks! An admin is verifying your Skool membership. Once you’re approved, Community and
              AI Coach unlock here automatically — we’ll notify you.
            </p>
            <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full py-3">
              Open the Skool community →
            </a>
          </>
        )}
      </div>
    </main>
  );
}
