// Social Media Audit engine. Scores are deterministic/formula-driven so they are
// comparable month-over-month; the AI only narrates recommendations (kept in
// ai-coach style). Since there is no real OAuth in this build, "connecting" stores
// a handle and metrics are simulated with a realistic growth trend that builds on
// the prior snapshot — faithfully exercising the snapshot → delta → score pipeline.

import { prisma } from "./prisma";

export type Metrics = {
  followers: number;
  followerGrowth: number; // since last snapshot
  posts: number; // in period
  engagementRate: number; // 0-100 (%)
  reach: number;
  postingVarianceDays: number; // lower = more consistent
  bioComplete: boolean;
  visualConsistency: number; // 0-100 (proxy for branding)
};

const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "x", "spotify"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const SUPPORTED_PLATFORMS = PLATFORMS;

// Deterministic pseudo-random from a string seed (no Math.random — reproducible).
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

/** Simulate a fresh metrics snapshot, building on the previous one if present. */
export function simulateMetrics(platform: string, handle: string, runIndex: number, prev?: Metrics): Metrics {
  const r = seeded(`${platform}:${handle}:${runIndex}`);
  const r2 = seeded(`${handle}:${platform}:${runIndex}:b`);
  const startFollowers = prev?.followers ?? Math.round(200 + r * 4000);
  // Growth trends upward over runs, with variance.
  const growthRate = 0.03 + r * 0.12; // 3%-15%
  const followerGrowth = Math.round(startFollowers * growthRate);
  const followers = startFollowers + followerGrowth;
  const posts = Math.round(4 + r2 * 16); // 4-20 posts in period
  const engagementRate = Math.round((1.5 + r2 * 6) * 10) / 10; // 1.5%-7.5%
  const reach = Math.round(followers * (0.4 + r * 1.2));
  const postingVarianceDays = Math.round(1 + (1 - r2) * 6); // 1-7
  return {
    followers,
    followerGrowth,
    posts,
    engagementRate,
    reach,
    postingVarianceDays,
    bioComplete: r > 0.25,
    visualConsistency: Math.round(45 + r * 50),
  };
}

export type AuditScores = {
  marketingScore: number;
  brandingScore: number;
  growthScore: number;
  consistencyScore: number;
};

/** Aggregate per-platform metrics into the four 0-100 scores. */
export function computeScores(all: Metrics[]): AuditScores {
  if (all.length === 0) return { marketingScore: 0, brandingScore: 0, growthScore: 0, consistencyScore: 0 };
  const avg = (f: (m: Metrics) => number) => all.reduce((s, m) => s + f(m), 0) / all.length;

  // Marketing: reach efficiency (reach/followers) + content volume + engagement.
  const reachEff = avg((m) => (m.followers ? m.reach / m.followers : 0)); // ~0.4-1.6
  const volume = avg((m) => Math.min(1, m.posts / 12));
  const eng = avg((m) => Math.min(1, m.engagementRate / 6));
  const marketingScore = clamp(Math.round((0.4 * Math.min(1, reachEff / 1.2) + 0.3 * volume + 0.3 * eng) * 100));

  // Branding: visual consistency + bio completeness.
  const visual = avg((m) => m.visualConsistency / 100);
  const bio = avg((m) => (m.bioComplete ? 1 : 0));
  const brandingScore = clamp(Math.round((0.75 * visual + 0.25 * bio) * 100));

  // Growth: follower growth rate, normalized (15%+ in a period is excellent).
  const growth = avg((m) => (m.followers ? m.followerGrowth / m.followers : 0));
  const growthScore = clamp(Math.round(Math.min(1, growth / 0.15) * 100));

  // Consistency: inverse of posting variance + adequate volume.
  const regularity = avg((m) => 1 - Math.min(1, m.postingVarianceDays / 7));
  const enough = avg((m) => Math.min(1, m.posts / 8));
  const consistencyScore = clamp(Math.round((0.6 * regularity + 0.4 * enough) * 100));

  return { marketingScore, brandingScore, growthScore, consistencyScore };
}

export function buildRecommendations(scores: AuditScores, metrics: Metrics[]): string[] {
  const recs: string[] = [];
  const entries: [keyof AuditScores, number][] = [
    ["marketingScore", scores.marketingScore],
    ["brandingScore", scores.brandingScore],
    ["growthScore", scores.growthScore],
    ["consistencyScore", scores.consistencyScore],
  ];
  const weakest = [...entries].sort((a, b) => a[1] - b[1])[0][0];

  const tips: Record<keyof AuditScores, string> = {
    marketingScore: "Add a clear call-to-action to every post and test 2 content formats to lift reach-per-follower.",
    brandingScore: "Tighten visual consistency: one color palette and template across your next 9 posts, and complete your bio.",
    growthScore: "Run a 7-day engagement push and one collaboration with a peer artist to accelerate follower growth.",
    consistencyScore: "Lock a fixed posting schedule (e.g. Mon/Wed/Fri) and batch-create a week ahead to cut your posting gaps.",
  };
  recs.push(`Priority: improve ${label(weakest)} — ${tips[weakest]}`);
  if (scores.consistencyScore < 60 && weakest !== "consistencyScore") recs.push(tips.consistencyScore);
  const avgEng = metrics.reduce((s, m) => s + m.engagementRate, 0) / Math.max(1, metrics.length);
  if (avgEng < 3) recs.push("Engagement is below 3% — ask questions in captions and reply within the first hour after posting.");
  recs.push("Re-run this audit next month to track your deltas and keep what's working.");
  return recs;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function label(k: keyof AuditScores) {
  return { marketingScore: "Marketing", brandingScore: "Branding", growthScore: "Growth", consistencyScore: "Consistency" }[k];
}

/** Run a full audit for a user: snapshot each connected account, score, persist a report. */
export async function runAudit(userId: string) {
  const accounts = await prisma.socialAccount.findMany({ where: { userId, status: "active" } });
  if (accounts.length === 0) return { error: "Connect at least one social account first." as const };

  const priorSnapshots = await prisma.auditSnapshot.count({ where: { userId } });
  const runIndex = Math.floor(priorSnapshots / Math.max(1, accounts.length));

  const metrics: Metrics[] = [];
  for (const acc of accounts) {
    const last = await prisma.auditSnapshot.findFirst({
      where: { userId, platform: acc.platform },
      orderBy: { capturedAt: "desc" },
    });
    const prev = last ? (JSON.parse(last.metrics) as Metrics) : undefined;
    const m = simulateMetrics(acc.platform, acc.handle, runIndex + 1, prev);
    metrics.push(m);
    await prisma.auditSnapshot.create({ data: { userId, platform: acc.platform, metrics: JSON.stringify(m) } });
  }

  const scores = computeScores(metrics);
  const prevReport = await prisma.auditReport.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  const deltas = prevReport
    ? {
        marketing: scores.marketingScore - prevReport.marketingScore,
        branding: scores.brandingScore - prevReport.brandingScore,
        growth: scores.growthScore - prevReport.growthScore,
        consistency: scores.consistencyScore - prevReport.consistencyScore,
      }
    : null;

  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 86_400_000);
  const report = await prisma.auditReport.create({
    data: {
      userId,
      periodStart,
      periodEnd: now,
      ...scores,
      deltas: JSON.stringify(deltas ?? {}),
      recommendations: JSON.stringify(buildRecommendations(scores, metrics)),
    },
  });

  // Feed the lowest area into coach memory so the AI Coach knows it.
  const weakest = (Object.entries(scores).sort((a, b) => (a[1] as number) - (b[1] as number))[0][0] as string).replace("Score", "");
  await prisma.coachMemory.create({
    data: { userId, kind: "insight", content: `Latest audit weakest area: ${weakest}. Followers total ${metrics.reduce((s, m) => s + m.followers, 0)}.`, weight: 2 },
  });

  return { report, metrics, totalFollowers: metrics.reduce((s, m) => s + m.followers, 0) };
}
