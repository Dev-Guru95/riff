import { requirePageSession } from "@/lib/auth";
import { computeLeaderboard } from "@/lib/leaderboard";
import { buildShare } from "@/lib/share";
import { Pagination } from "@/components/Pagination";
import { ShareToSkool } from "@/components/ShareToSkool";
import { PageHeader, TableCard, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { RedeemBox } from "./RedeemBox";

const PAGE_SIZE = 50;

// Shared between the header row and the data rows so the columns line up.
const COLS = "grid-cols-[3rem_4rem_1fr_5rem_5rem_4rem]";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requirePageSession();
  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const all = await computeLeaderboard({ scope: "global" });
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasNext = all.length > page * PAGE_SIZE;
  const me = all.find((r) => r.userId === session.id);

  return (
    <main className="max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Global Leaderboard"
        subtitle={
          <>
            Ranked by a blend of XP, quiz &amp; assignment quality, speed, and consistency.
            <br />
            Top 1000 each period qualify for subscription discounts and rewards.
          </>
        }
        action={
          me && (
            <ShareToSkool
              share={buildShare({
                kind: "leaderboard",
                value: me.rank,
                stageName: me.stageName,
                detail: "Climbing the Riff ranks.",
              })}
              label={`Share #${me.rank}`}
              size="sm"
              variant="ghost"
            />
          )
        }
      />

      <TableCard>
        <div className="overflow-x-auto">
          <div className="min-w-[34rem]">
            <div className={`grid ${COLS} gap-2 px-4 py-2.5 text-xs font-medium text-[var(--muted)] border-b border-[var(--border)]`}>
              <span>Rank</span>
              <span>Position</span>
              <span>Artist</span>
              <span className="text-right">XP</span>
              <span className="text-right">Quiz</span>
              <span className="text-right" title="Current day streak">Streak</span>
            </div>
            {rows.map((r) => {
              const isMe = r.userId === session.id;
              return (
                <div
                  key={r.userId}
                  className={`grid ${COLS} gap-2 px-4 py-3 text-sm border-b border-[var(--border)] last:border-0 items-center ${
                    isMe ? "bg-[var(--surface-2)]" : ""
                  }`}
                >
                  <span>
                    <Icon
                      name="trophy"
                      size={17}
                      className={r.rank <= 3 ? "text-[var(--warning)]" : "text-[var(--muted)]"}
                    />
                  </span>
                  <span className="font-semibold tabular-nums">{r.rank}</span>
                  <span className="truncate">
                    <span className={isMe ? "font-semibold" : ""}>{r.stageName}</span>
                    {isMe && <span className="text-[var(--accent)] text-xs ml-1">(you)</span>}
                    {r.countryCode && <span className="text-[var(--muted)] text-xs ml-1">&middot; {r.countryCode}</span>}
                  </span>
                  <span className="text-right tabular-nums">{r.totalXp}</span>
                  <span className="text-right tabular-nums">{r.avgQuiz || "—"}</span>
                  <span className="text-right tabular-nums">{r.streak}</span>
                </div>
              );
            })}
          </div>
        </div>
        {rows.length === 0 && <EmptyState icon="trophy" title="No artists ranked yet." />}
      </TableCard>

      <Pagination basePath="/leaderboard" page={page} hasNext={hasNext} />
      <RedeemBox />
    </main>
  );
}
