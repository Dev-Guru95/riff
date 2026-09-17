import { getSession } from "@/lib/auth";
import { listBoardsForUser, loadDashboard } from "@/lib/boards";
import { BoardsClient } from "./BoardsClient";
import { Dashboard } from "./Dashboard";
import { GlobalSearch } from "./GlobalSearch";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Projects — Riff" };

export default async function BoardsPage() {
  const session = (await getSession())!;
  const [boards, dashboard] = await Promise.all([
    listBoardsForUser(session.id),
    loadDashboard(session.id),
  ]);
  return (
    <main className="max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader title="Projects" subtitle="Plan and track your work on kanban boards" />

      <div className="mb-6">
        <GlobalSearch />
      </div>

      <Dashboard data={dashboard} />

      <h2 className="text-sm font-semibold mb-3">Your boards</h2>
      <BoardsClient initialBoards={boards} />
    </main>
  );
}
