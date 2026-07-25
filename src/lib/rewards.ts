import { prisma } from "./prisma";
import { computeLeaderboard } from "./leaderboard";
import { notify } from "./notifications";

function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Snapshot the current global leaderboard and grant the reward coupon to the top
 * N artists (default 1000). Idempotent per period — re-running the same week
 * won't double-notify. Closes audit gap: "Top-1000 qualification & rewards".
 */
export async function issueLeaderboardRewards(topN = 1000, rewardCode = "TOP1000") {
  const period = weekKey(new Date());
  const board = await computeLeaderboard({ scope: "global" });
  const top = board.slice(0, topN);

  // Persist a historical snapshot of the whole board (audit: historical rankings).
  // Skip if this period was already snapshotted.
  const already = await prisma.leaderboardSnapshot.count({ where: { scope: "global", periodKey: period } });
  if (already === 0) {
    for (const row of board) {
      await prisma.leaderboardSnapshot.create({
        data: { userId: row.userId, scope: "global", rank: row.rank, composite: row.composite, periodKey: period },
      });
    }
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: rewardCode } });
  let notified = 0;
  for (const row of top) {
    // One reward notification per user per period.
    const exists = await prisma.notification.findFirst({
      where: { userId: row.userId, type: "reward", body: { contains: period } },
    });
    if (exists) continue;
    await notify(row.userId, {
      type: "reward",
      title: `🎁 You ranked #${row.rank} — reward unlocked!`,
      body: coupon ? `Use code ${coupon.code} for ${coupon.value}% off (period ${period})` : `Top-${topN} reward (period ${period})`,
      link: "/leaderboard",
    });
    notified++;
  }

  return { period, ranked: board.length, rewarded: top.length, notified };
}
