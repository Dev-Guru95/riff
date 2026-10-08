import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth";
import { loadBoardForUser } from "@/lib/boards";
import { BoardView } from "./BoardView";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageSession();
  const { id } = await params;
  const board = await loadBoardForUser(id, session.id);
  if (!board) notFound();
  return <BoardView initial={board} currentUserId={session.id} />;
}
