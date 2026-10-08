// Kanban / Projects response types.
//
// Copied verbatim (pure type definitions only) from the web repo's
// src/lib/boards.ts — BoardCapabilities, BoardSummary, BoardCardDTO, BoardDTO,
// ChecklistItemDTO, ChecklistDTO, CardDetailDTO, ActivityDTO, CommentDTO,
// TaskLite, DashboardDTO and SearchResults. Re-copy when that file changes.
// The wrapper types at the bottom describe what each API route returns around them.

import type { BoardRole } from "@/lib/constants";

export type BoardCapabilities = {
  view: boolean;
  comment: boolean;
  editCards: boolean; // create / edit / move / archive cards, checklists, card labels
  assignOthers: boolean; // assign teammates (members can still self-assign)
  manageColumns: boolean; // create / rename / delete / reorder columns
  manageLabels: boolean; // create / delete board label definitions
  manageBoard: boolean; // rename board, edit settings, archive board
  manageMembers: boolean; // add / remove members, change their roles
  deleteBoard: boolean; // hard-delete board / transfer ownership (owner only)
};

export type BoardSummary = {
  id: string;
  title: string;
  description: string;
  color: string;
  kind: string;
  archived: boolean;
  role: BoardRole;
  memberCount: number;
  cardCount: number;
  updatedAt: string;
};

export type BoardCardDTO = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  orderIndex: number;
  priority: string | null;
  dueDate: string | null;
  startDate: string | null;
  completion: number;
  labels: { id: string; name: string; color: string }[];
  assignees: { userId: string; name: string }[];
  checklist: { done: number; total: number };
  counts: { comments: number; attachments: number; checklists: number };
};

export type BoardDTO = {
  id: string;
  title: string;
  description: string;
  color: string;
  kind: string;
  archived: boolean;
  ownerId: string;
  role: BoardRole;
  can: BoardCapabilities;
  members: { userId: string; role: BoardRole; name: string; email: string }[];
  labels: { id: string; name: string; color: string }[];
  columns: { id: string; title: string; orderIndex: number; cardTotal: number; cards: BoardCardDTO[] }[];
};

export type ChecklistItemDTO = { id: string; text: string; done: boolean; orderIndex: number };
export type ChecklistDTO = { id: string; title: string; orderIndex: number; items: ChecklistItemDTO[] };
export type CardDetailDTO = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimateMinutes: number | null;
  completion: number;
  archived: boolean;
  labelIds: string[];
  assignees: { userId: string; name: string }[];
  checklists: ChecklistDTO[];
  attachments: { id: string; name: string; url: string; mime: string; size: number }[];
  watching: boolean;
  watchersCount: number;
};

export type ActivityDTO = { id: string; actor: string; text: string; createdAt: string };

export type CommentDTO = { id: string; userId: string; author: string; body: string; createdAt: string; mine: boolean };

export type TaskLite = { id: string; boardId: string; title: string; dueDate: string | null; boardTitle: string };
export type DashboardDTO = {
  openCount: number;
  completedCount: number;
  dueToday: TaskLite[];
  overdue: TaskLite[];
  upcoming: TaskLite[];
  boardProgress: { id: string; title: string; color: string; done: number; total: number }[];
  recentBoards: { id: string; title: string; color: string; when: string }[];
  workload: { userId: string; name: string; open: number }[];
};

export type SearchResults = {
  boards: { id: string; title: string }[];
  cards: { id: string; boardId: string; title: string; boardTitle: string }[];
  labels: { id: string; boardId: string; name: string; color: string; boardTitle: string }[];
  comments: { cardId: string; boardId: string; snippet: string; boardTitle: string }[];
  attachments: { cardId: string; boardId: string; name: string; boardTitle: string }[];
  users: { userId: string; name: string; email: string }[];
};

// ---- Route envelopes (src/app/api/**) --------------------------------------

/** GET /api/boards */
export type BoardsResponse = { boards: BoardSummary[] };
/** GET /api/boards/[id] */
export type BoardResponse = { board: BoardDTO };
/** GET /api/cards/[id] */
export type CardResponse = { card: CardDetailDTO; can: BoardCapabilities };
/** GET /api/columns/[id]/cards?offset= */
export type ColumnCardsResponse = { cards: BoardCardDTO[] };
/** GET /api/boards/[id]/activity and /api/cards/[id]/activity */
export type ActivityResponse = { activity: ActivityDTO[] };
/** GET /api/cards/[id]/comments */
export type CommentsResponse = { comments: CommentDTO[] };
/** GET /api/boards/[id]/archive */
export type ArchiveResponse = { cards: { id: string; title: string; columnTitle: string }[] };
/** GET /api/boards/[id]/members?q= */
export type MemberSearchResponse = { users: { userId: string; name: string; email: string }[] };
/** GET /api/search?q= */
export type SearchResponse = { results: SearchResults };
/** POST /api/uploads */
export type UploadResponse = { url: string; category: string; size: number };
