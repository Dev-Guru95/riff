import { getSession } from "@/lib/auth";
import { listBoardsForUser, loadDashboard } from "@/lib/boards";
import { BoardsClient } from "./BoardsClient";
import { Dashboard } from "./Dashboard";
import { GlobalSearch } from "./GlobalSearch";

export const metadata = { title: "Projects — Riff" };

export default async function BoardsPage() {
  const session = (await getSession())!;
  const [boards, dashboard] = await Promise.all([
    listBoardsForUser(session.id),
    loadDashboard(session.id),
  ]);
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">🗂️ Projects</h1>
      </div>
      <p className="text-sm text-[var(--muted)] mb-4">
        Plan and track your work on Kanban boards — right inside Riff.
      </p>

      <div className="mb-6">
        <GlobalSearch />
      </div>

      <Dashboard data={dashboard} />

      <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Your boards</h2>
      <BoardsClient initialBoards={boards} />
    </main>
  );
}
