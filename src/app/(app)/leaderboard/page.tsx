import { getSession } from "@/lib/auth";
import { computeLeaderboard } from "@/lib/leaderboard";
import { buildShare } from "@/lib/share";
import { Pagination } from "@/components/Pagination";
import { ShareToSkool } from "@/components/ShareToSkool";
import { RedeemBox } from "./RedeemBox";

const PAGE_SIZE = 50;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = (await getSession())!;
  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const all = await computeLeaderboard({ scope: "global" });
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasNext = all.length > page * PAGE_SIZE;
  const me = all.find((r) => r.userId === session.id);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold">🏆 Global Leaderboard</h1>
        {me && (
          <ShareToSkool
            share={buildShare({ kind: "leaderboard", value: me.rank, stageName: me.stageName, detail: "Climbing the Riff ranks." })}
            label={`Share #${me.rank}`}
            size="sm"
            variant="ghost"
          />
        )}
      </div>
      <p className="text-[var(--muted)] text-sm mb-6">
        Ranked by a blend of XP, quiz & assignment quality, speed, and consistency. Top 1000 each
        period qualify for subscription discounts and rewards.
      </p>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3 text-xs text-[var(--muted)] border-b border-[var(--border)]">
          <span>Rank</span><span>Artist</span><span className="text-right">XP</span>
          <span className="text-right">Quiz</span><span className="text-right">🔥</span>
        </div>
        {rows.map((r) => {
          const isMe = r.userId === session.id;
          return (
            <div
              key={r.userId}
              className={`grid grid-cols-[3rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 ${
                isMe ? "bg-[var(--surface-2)]" : ""
              }`}
            >
              <span className="font-bold">{medal(r.rank)}</span>
              <span className="truncate">
                {r.stageName} {isMe && <span className="text-[var(--accent)] text-xs">(you)</span>}
                {r.countryCode && <span className="text-[var(--muted)] text-xs ml-1">· {r.countryCode}</span>}
              </span>
              <span className="text-right">{r.totalXp}</span>
              <span className="text-right">{r.avgQuiz || "—"}</span>
              <span className="text-right">{r.streak}</span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="px-4 py-8 text-center text-[var(--muted)]">No artists ranked yet.</div>}
      </div>
      <Pagination basePath="/leaderboard" page={page} hasNext={hasNext} />
      <RedeemBox />
    </main>
  );
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
