/**
 * What each plan actually gives you.
 *
 * Pure and client-safe, like `pricing.ts`. This file is the *copy* half of the
 * plan definition; `entitlements.ts` is the *enforcement* half. Every claim
 * below has to be enforced somewhere — a feature list that promises more than
 * the code checks is the bug reviewers found last time ("weekly missions" was
 * sold as Pro while Free users could complete them), so the enforcement point
 * is named in a comment next to anything gated.
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
    audience: "For independent artists actively releasing, marketing and selling.",
  },
  premium: {
    name: "Premium",
    tagline: "Your strategist, not just your toolkit",
    audience: "For artists who want a plan built around them and a human in the loop.",
  },
};

/** The 5–6 lines on a pricing card. Short, concrete, and true. */
export const PLAN_HIGHLIGHTS: Record<PlanKeyLike, string[]> = {
  free: [
    "All 8 course tracks, quizzes & certificates",
    "AI Coach — 5 messages a day",
    "1 social account audited",
    "Studio planners: brand kit, merch, finance, fans",
    "30-day career roadmap",
  ],
  pro: [
    "Everything in Free",
    "Unlimited AI Coach",
    "All 6 socials audited, every month",
    "Full career roadmap — 30-day to 12-month",
    "Weekly missions, XP & leaderboard rewards",
    "AI merch concepts + margin coach — 3 plans a day",
  ],
  premium: [
    "Everything in Pro",
    "Human-reviewed assignments, queued first",
    "AI merch launch campaigns — week-by-week",
    "12 AI merch plans a day",
    "Deeper, longer AI strategy on every tool",
  ],
};

export type FeatureValue = boolean | string;

export type FeatureRow = {
  label: string;
  /** One line on what the feature is for. Shown under the label. */
  hint?: string;
  free: FeatureValue;
  pro: FeatureValue;
  premium: FeatureValue;
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
        premium: true,
      },
      {
        label: "Assignment feedback",
        hint: "Every submission is AI-scored against a rubric.",
        free: "AI-scored",
        pro: "AI-scored",
        premium: "AI + human review",
      },
      {
        label: "Priority in the human review queue",
        // Enforced: src/app/(admin)/admin/submissions — Premium sorts first.
        hint: "Premium submissions are reviewed before everyone else's.",
        free: false,
        pro: false,
        premium: true,
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
        premium: "Unlimited",
      },
      {
        label: "Career roadmap horizons",
        // Enforced: src/app/api/roadmap/route.ts — free is 30d only.
        hint: "A dated milestone plan generated from your real progress.",
        free: "30-day",
        pro: "30-day → 12-month",
        premium: "30-day → 12-month",
      },
      {
        label: "AI depth on generated plans",
        hint: "How much the AI tools write before they stop.",
        free: "Standard",
        pro: "Standard",
        premium: "Extended",
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
        premium: "All 6",
      },
      {
        label: "Caption & hashtag generator",
        free: true,
        pro: true,
        premium: true,
      },
      {
        label: "Fan CRM, segments & broadcasts",
        hint: "Tag your audience and send targeted updates.",
        free: true,
        pro: true,
        premium: true,
      },
      {
        label: "Weekly missions, XP & leaderboard rewards",
        // Enforced: src/app/api/missions/[id]/complete — weeklyMissions.
        hint: "Weekly marketing tasks that pay XP and reward codes.",
        free: false,
        pro: true,
        premium: true,
      },
    ],
  },
  {
    title: "Money & merch",
    rows: [
      {
        label: "Merch planner — margins, break-even, pipeline",
        hint: "Cost, price and stock turned into profit per unit and per drop.",
        free: true,
        pro: true,
        premium: true,
      },
      {
        label: "Log merch sales straight into Revenue",
        free: true,
        pro: true,
        premium: true,
      },
      {
        label: "AI merch concepts & pricing",
        // Enforced: src/app/api/studio/merch/plan — merchPlansPerDay.
        hint: "Product ideas costed for your genre, with a suggested retail price.",
        free: false,
        pro: "3 plans a day",
        premium: "12 plans a day",
      },
      {
        label: "AI merch launch campaign",
        // Enforced: src/app/api/studio/merch/plan — merchCampaignPlans.
        hint: "A week-by-week drop plan: teasers, launch day, restock, bundles.",
        free: false,
        pro: false,
        premium: true,
      },
      {
        label: "Revenue & budget tracker, gig fees",
        free: true,
        pro: true,
        premium: true,
      },
    ],
  },
  {
    title: "Organise the work",
    rows: [
      { label: "Project boards, content calendar, pitch tracker", free: true, pro: true, premium: true },
      { label: "Brand kit, link-in-bio, booking scheduler", free: true, pro: true, premium: true },
      { label: "Goals & milestone tracking", free: true, pro: true, premium: true },
    ],
  },
];

/** The one sentence that explains why Premium exists next to Pro. */
export const PREMIUM_DIFFERENCE =
  "Pro gives you the tools. Premium adds the strategist: human-reviewed assignments at the front of the queue, week-by-week launch campaigns, and longer, deeper AI output on every plan it writes.";
