/**
 * What each plan gives you.
 *
 * Pure and client-safe, like `pricing.ts`. This file is the *copy* half of the
 * plan definition; `entitlements.ts` is the *enforcement* half. Every claim
 * below has to be enforced somewhere — a feature list that promises more than
 * the code checks is the bug reviewers found once already ("weekly missions"
 * was sold as Pro while Free users could complete them for XP) — so the
 * enforcement point is named in a comment next to anything gated.
 *
 * Two rules this file exists to keep:
 *
 *  1. **Free and Pro only.** Enterprise, for management companies and labels,
 *     is a later conversation. There is no third column here until it is real.
 *  2. **Nothing may imply a person.** Riff is an AI platform. Every generated
 *     or scored thing is labelled AI, and no plan promises that a human will
 *     look at an artist's work, account or strategy.
 */

import type { PaidPlanKey } from "./pricing";

export type PlanKeyLike = "free" | PaidPlanKey;

/** How each tier is positioned. The card headline and who it is for. */
export const PLAN_META: Record<PlanKeyLike, { name: string; tagline: string; audience: string }> = {
  free: {
    name: "Free",
    tagline: "Learn the craft and prove it",
    audience: "For artists working through the Riff tracks for the first time.",
  },
  pro: {
    name: "Pro",
    tagline: "Run your music like a business",
    audience: "For independent artists actively releasing, marketing and growing.",
  },
};

/** The lines on a pricing card. Short, concrete, and true. */
export const PLAN_HIGHLIGHTS: Record<PlanKeyLike, string[]> = {
  free: [
    "All 8 course tracks, quizzes & certificates",
    "AI Coach — 5 messages a day",
    "1 social account audited",
    "Studio planners: brand kit, fans, finance, goals",
    "30-day AI career roadmap",
  ],
  pro: [
    "Everything in Free",
    "Unlimited AI Coach",
    "All 6 socials audited, every month",
    "Full AI career roadmap — 30-day to 12-month",
    "Weekly missions, XP & leaderboard rewards",
  ],
};

export type FeatureValue = boolean | string;

export type FeatureRow = {
  label: string;
  /** One line on what the feature is for. Shown under the label. */
  hint?: string;
  free: FeatureValue;
  pro: FeatureValue;
};

export type FeatureGroup = { title: string; rows: FeatureRow[] };

/**
 * The full comparison, grouped by the job an artist is trying to do rather
 * than by which part of the codebase a feature lives in.
 */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Learn & get certified",
    rows: [
      {
        label: "All course tracks, quizzes & certificates",
        hint: "Riff is the assessment half of the Skool loop — never paywalled.",
        free: true,
        pro: true,
      },
      {
        label: "Assignment feedback",
        hint: "Every submission is scored against a rubric by AI.",
        free: "AI-scored",
        pro: "AI-scored",
      },
    ],
  },
  {
    title: "Strategy & AI assistance",
    rows: [
      {
        label: "AI Coach messages",
        // Enforced: withinCoachQuota() in src/lib/entitlements.ts.
        hint: "A music-marketing mentor that knows your genre, goals and scores.",
        free: "5 a day",
        pro: "Unlimited",
      },
      {
        label: "AI career roadmap",
        // Enforced: src/app/api/roadmap/route.ts — free is 30d only.
        hint: "A dated milestone plan generated from your real progress.",
        free: "30-day",
        pro: "30-day → 12-month",
      },
    ],
  },
  {
    title: "Marketing & audience",
    rows: [
      {
        label: "Social accounts audited",
        // Enforced: src/app/(app)/audit — connectionLimit={ent.socialConnections}.
        hint: "Marketing, branding, growth and consistency scored per platform.",
        free: "1",
        pro: "All 6",
      },
      {
        label: "AI caption & hashtag generator",
        free: true,
        pro: true,
      },
      {
        label: "Fan CRM, segments & broadcasts",
        hint: "Tag your audience and send targeted updates.",
        free: true,
        pro: true,
      },
      {
        label: "Weekly missions, XP & leaderboard rewards",
        // Enforced: src/app/api/missions/[id]/complete — weeklyMissions.
        hint: "Weekly marketing tasks that pay XP and reward codes.",
        free: false,
        pro: true,
      },
    ],
  },
  {
    title: "Organise the work",
    rows: [
      { label: "Revenue & budget tracker", free: true, pro: true },
      { label: "Project boards, content calendar, pitch tracker", free: true, pro: true },
      { label: "Brand kit, link-in-bio, booking scheduler", free: true, pro: true },
      { label: "Goals & milestone tracking", free: true, pro: true },
    ],
  },
];
