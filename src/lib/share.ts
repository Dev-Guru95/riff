import { SKOOL_URL } from "./constants";

// Builds the copy for a "Share to Skool" action. Skool has no public post API,
// so sharing is one-tap, student-initiated: we prefill a caption + open the
// community. Never claim it auto-posts.
export type ShareKind =
  | "xp"
  | "level"
  | "badge"
  | "streak"
  | "certificate"
  | "leaderboard"
  | "milestone"
  | "challenge";

export type ShareInput = {
  kind: ShareKind;
  stageName?: string | null;
  // free-form details per kind (level name, badge name, streak length, rank…)
  value?: string | number;
  detail?: string;
};

export type SharePayload = {
  headline: string; // shown on the in-app share card
  emoji: string;
  caption: string; // what gets copied for the Skool post
  url: string; // the community to open
};

export function buildShare(input: ShareInput): SharePayload {
  const who = input.stageName?.trim() || "I";
  const isI = who === "I";
  const verb = (i: string, other: string) => (isI ? i : other);

  const map: Record<ShareKind, { emoji: string; headline: string; caption: string }> = {
    xp: {
      emoji: "⚡",
      headline: `${input.value} XP earned`,
      caption: `${who} just earned ${input.value} XP on Riff! ⚡ Grinding the business side of my music career. #Soundring`,
    },
    level: {
      emoji: "🚀",
      headline: `Leveled up to ${input.value}`,
      caption: `Level up! ${who} just reached ${input.value} on Riff 🚀 The music business grind is paying off. #Soundring`,
    },
    badge: {
      emoji: "🏅",
      headline: `Badge unlocked: ${input.value}`,
      caption: `${who} just unlocked the "${input.value}" badge on Riff 🏅 ${input.detail ?? ""}`.trim() + " #Soundring",
    },
    streak: {
      emoji: "🔥",
      headline: `${input.value}-day streak`,
      caption: `${verb("I'm", `${who} is`)} on a ${input.value}-day streak on Riff 🔥 Showing up every single day. Who's with me? #Soundring`,
    },
    certificate: {
      emoji: "🎓",
      headline: `Certified: ${input.value}`,
      caption: `${verb("I", `${who}`)} just completed "${input.value}" on Riff and earned my certificate! 🎓 On to the next one. #Soundring`,
    },
    leaderboard: {
      emoji: "🏆",
      headline: `Ranked #${input.value}`,
      caption: `${verb("I", `${who}`)} hit #${input.value} on the Riff leaderboard 🏆 ${input.detail ?? "Climbing every week."} #Soundring`,
    },
    milestone: {
      emoji: "🎯",
      headline: `Milestone: ${input.value}`,
      caption: `Milestone unlocked on Riff: ${input.value} 🎯 ${input.detail ?? ""}`.trim() + " #Soundring",
    },
    challenge: {
      emoji: "✅",
      headline: `Challenge done: ${input.value}`,
      caption: `${verb("I", `${who}`)} just completed the "${input.value}" challenge on Riff ✅ ${input.detail ?? ""}`.trim() + " #Soundring",
    },
  };

  const m = map[input.kind];
  return { headline: m.headline, emoji: m.emoji, caption: m.caption, url: SKOOL_URL };
}
