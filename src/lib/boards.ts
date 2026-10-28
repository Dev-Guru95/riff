// Kanban / project-management server helpers: per-board permissions, data
// loaders, and the activity-log writer. Mirrors the app's conventions
// (fire-and-forget side effects, cuid ids, orderIndex ordering). Pure server
// module — only imported by route handlers and Server Components.
import { prisma, ci } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { templateFor } from "@/lib/board-templates";
import { todayKey } from "@/lib/gamification";
import type { Prisma } from "@prisma/client";
import type { BoardRole } from "@/lib/constants";

// Max cards loaded per column on first paint; the rest lazy-load via
// loadColumnCards / GET /api/columns/[id]/cards.
export const CARD_PAGE = 50;

// ---- Permissions -----------------------------------------------------------

// Higher rank = more privilege. Capability checks derive from this so we never
// scatter role-string comparisons through the routes.
export const ROLE_RANK: Record<BoardRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
  guest: 0,
};

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

export function capabilitiesFor(role: BoardRole): BoardCapabilities {
  const rank = ROLE_RANK[role];
  return {
    view: rank >= 0,
    comment: rank >= 0,
    editCards: rank >= 1, // member+
    assignOthers: rank >= 2, // manager+
    manageColumns: rank >= 2, // manager+
    manageLabels: rank >= 2, // manager+
    manageBoard: rank >= 3, // admin+
    manageMembers: rank >= 3, // admin+
    deleteBoard: rank >= 4, // owner only
  };
}

export async function getMembership(
  boardId: string,
  userId: string,
): Promise<{ role: BoardRole } | null> {
  const m = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  return m ? { role: m.role as BoardRole } : null;
}

/**
 * Central access check for routes. Returns the caller's role + capabilities, or
 * `null` when they are not a member (callers should then return a 404 to avoid
 * leaking board existence, matching the app's ownership idiom).
 */
export async function boardAccess(
  boardId: string,
  userId: string,
): Promise<{ role: BoardRole; can: BoardCapabilities } | null> {
  const m = await getMembership(boardId, userId);
  if (!m) return null;
  return { role: m.role, can: capabilitiesFor(m.role) };
}

// ---- Display names ---------------------------------------------------------
// User has no name/avatar column; the display name lives on ArtistProfile.stageName.
// Fall back to the email local-part. Used for member lists, assignees, mentions.

export async function nameMap(
  userIds: string[],
): Promise<Map<string, { name: string; email: string }>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, { name: string; email: string }>();
  if (ids.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, profile: { select: { stageName: true } } },
  });
  for (const u of users) {
    map.set(u.id, { name: u.profile?.stageName?.trim() || u.email.split("@")[0], email: u.email });
  }
  return map;
}

// ---- Activity log ----------------------------------------------------------
// Fire-and-forget append; never throws into the request path (mirrors track()/notify()).
export async function logActivity(input: {
  boardId: string;
  actorId: string;
  verb: string;
  cardId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        boardId: input.boardId,
        actorId: input.actorId,
        verb: input.verb,
        cardId: input.cardId ?? null,
        meta: JSON.stringify(input.meta ?? {}),
      },
    });
  } catch (e) {
    console.error("[activity] failed", e);
  }
}

// ---- Creation --------------------------------------------------------------

/**
 * Create a board from a template — seeds the template's columns and labels, adds
 * the creator as owner, all in one transaction. `kind` selects the template
 * (defaults to a blank generic board).
 */
export async function createBoard(userId: string, title: string, kind = "generic"): Promise<string> {
  const tpl = templateFor(kind);
  const board = await prisma.$transaction(async (tx) => {
    const b = await tx.board.create({ data: { ownerId: userId, title, kind: tpl.kind } });
    await tx.boardMember.create({ data: { boardId: b.id, userId, role: "owner" } });
    await tx.boardColumn.createMany({
      data: tpl.columns.map((t, i) => ({ boardId: b.id, title: t, orderIndex: i })),
    });
    if (tpl.labels.length > 0) {
      await tx.label.createMany({ data: tpl.labels.map((l) => ({ boardId: b.id, name: l.name, color: l.color })) });
    }
    return b;
  });
  await logActivity({ boardId: board.id, actorId: userId, verb: "created", meta: { title, kind: tpl.kind } });
  return board.id;
}

// ---- Loaders ---------------------------------------------------------------

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

/** All boards the user belongs to, newest-activity first, with light counts. */
export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    select: {
      role: true,
      board: {
        select: {
          id: true,
          title: true,
          description: true,
          color: true,
          kind: true,
          archived: true,
          updatedAt: true,
          _count: { select: { members: true, cards: true } },
        },
      },
    },
  });
  return memberships
    .map((m) => ({
      id: m.board.id,
      title: m.board.title,
      description: m.board.description,
      color: m.board.color,
      kind: m.board.kind,
      archived: m.board.archived,
      role: m.role as BoardRole,
      memberCount: m.board._count.members,
      cardCount: m.board._count.cards,
      updatedAt: m.board.updatedAt.toISOString(),
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

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

// Shared card include + serializer so the initial board load and the paginated
// column endpoint return identical card shapes.
const boardCardInclude = {
  labels: { include: { label: true } },
  assignees: true,
  checklists: { select: { items: { select: { done: true } } } },
  _count: { select: { comments: true, attachments: true, checklists: true } },
} satisfies Prisma.CardInclude;

type BoardCardRow = Prisma.CardGetPayload<{ include: typeof boardCardInclude }>;

function serializeBoardCard(card: BoardCardRow, names: Map<string, { name: string }>): BoardCardDTO {
  return {
    id: card.id,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    orderIndex: card.orderIndex,
    priority: card.priority,
    dueDate: card.dueDate?.toISOString() ?? null,
    startDate: card.startDate?.toISOString() ?? null,
    completion: card.completion,
    labels: card.labels.map((cl) => ({ id: cl.label.id, name: cl.label.name, color: cl.label.color })),
    assignees: card.assignees.map((a) => ({ userId: a.userId, name: names.get(a.userId)?.name ?? "?" })),
    checklist: {
      done: card.checklists.reduce((n, cl) => n + cl.items.filter((i) => i.done).length, 0),
      total: card.checklists.reduce((n, cl) => n + cl.items.length, 0),
    },
    counts: { comments: card._count.comments, attachments: card._count.attachments, checklists: card._count.checklists },
  };
}

/**
 * Full board tree for the board page, scoped to a member. Returns null if the
 * board doesn't exist OR the user isn't a member (caller → 404). Excludes
 * archived cards from the columns.
 */
export async function loadBoardForUser(
  boardId: string,
  userId: string,
): Promise<BoardDTO | null> {
  const access = await boardAccess(boardId, userId);
  if (!access) return null;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      labels: { orderBy: { createdAt: "asc" } },
      members: true,
      columns: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { cards: { where: { archived: false } } } },
          cards: {
            where: { archived: false },
            orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
            take: CARD_PAGE,
            include: boardCardInclude,
          },
        },
      },
    },
  });
  if (!board) return null;

  const names = await nameMap([
    board.ownerId,
    ...board.members.map((m) => m.userId),
    ...board.columns.flatMap((c) => c.cards.flatMap((card) => card.assignees.map((a) => a.userId))),
  ]);

  return {
    id: board.id,
    title: board.title,
    description: board.description,
    color: board.color,
    kind: board.kind,
    archived: board.archived,
    ownerId: board.ownerId,
    role: access.role,
    can: access.can,
    members: board.members.map((m) => ({
      userId: m.userId,
      role: m.role as BoardRole,
      name: names.get(m.userId)?.name ?? "Unknown",
      // Only expose member emails to those who manage members (admins+); guests/
      // members see names only.
      email: access.can.manageMembers ? (names.get(m.userId)?.email ?? "") : "",
    })),
    labels: board.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    columns: board.columns.map((col) => ({
      id: col.id,
      title: col.title,
      orderIndex: col.orderIndex,
      cardTotal: col._count.cards,
      cards: col.cards.map((card) => serializeBoardCard(card, names)),
    })),
  };
}

/** Paginated cards for one column (lazy-load "show more"). Member-scoped. */
export async function loadColumnCards(
  columnId: string,
  userId: string,
  offset: number,
  take = CARD_PAGE,
): Promise<BoardCardDTO[] | null> {
  const col = await prisma.boardColumn.findUnique({ where: { id: columnId }, select: { boardId: true } });
  if (!col || !(await boardAccess(col.boardId, userId))) return null;
  const cards = await prisma.card.findMany({
    where: { columnId, archived: false },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    skip: Math.max(0, offset),
    take: Math.min(take, CARD_PAGE),
    include: boardCardInclude,
  });
  const names = await nameMap(cards.flatMap((c) => c.assignees.map((a) => a.userId)));
  return cards.map((c) => serializeBoardCard(c, names));
}

// ---- Card detail (for the card modal) --------------------------------------

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

/** Full detail for one card, scoped to a board member (else null → 404). */
export async function loadCardDetail(
  cardId: string,
  userId: string,
): Promise<{ card: CardDetailDTO; can: BoardCapabilities } | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: { select: { labelId: true } },
      assignees: true,
      watchers: { select: { userId: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      checklists: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!card) return null;
  const access = await boardAccess(card.boardId, userId);
  if (!access) return null;
  const names = await nameMap(card.assignees.map((a) => a.userId));

  return {
    can: access.can,
    card: {
      id: card.id,
      boardId: card.boardId,
      columnId: card.columnId,
      title: card.title,
      description: card.description,
      priority: card.priority,
      dueDate: card.dueDate?.toISOString() ?? null,
      startDate: card.startDate?.toISOString() ?? null,
      estimateMinutes: card.estimateMinutes,
      completion: card.completion,
      archived: card.archived,
      labelIds: card.labels.map((l) => l.labelId),
      assignees: card.assignees.map((a) => ({ userId: a.userId, name: names.get(a.userId)?.name ?? "?" })),
      checklists: card.checklists.map((cl) => ({
        id: cl.id,
        title: cl.title,
        orderIndex: cl.orderIndex,
        items: cl.items.map((it) => ({ id: it.id, text: it.text, done: it.done, orderIndex: it.orderIndex })),
      })),
      attachments: card.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, mime: a.mime, size: a.size })),
      watching: card.watchers.some((w) => w.userId === userId),
      watchersCount: card.watchers.length,
    },
  };
}

// ---- Collaboration: mentions, participants, activity feed -------------------

/**
 * Resolve @mentions in a comment body to board-member user ids. A member is
 * matched when a `@token` equals their display name with spaces removed, or
 * their email local-part (both case-insensitive). Server-side (never trust the
 * client's list).
 */
export function parseMentions(
  body: string,
  members: { userId: string; name: string; email: string }[],
): string[] {
  const tokens = new Set((body.match(/@([A-Za-z0-9_.]+)/g) ?? []).map((t) => t.slice(1).toLowerCase()));
  if (tokens.size === 0) return [];
  const out = new Set<string>();
  for (const m of members) {
    const handle = m.name.replace(/\s+/g, "").toLowerCase();
    const local = m.email.split("@")[0].toLowerCase();
    if (tokens.has(handle) || tokens.has(local)) out.add(m.userId);
  }
  return [...out];
}

/** Watchers ∪ assignees of a card, minus one user (the actor). For fan-out notifications. */
export async function cardParticipants(cardId: string, excludeUserId: string): Promise<string[]> {
  const [watchers, assignees] = await Promise.all([
    prisma.cardWatcher.findMany({ where: { cardId }, select: { userId: true } }),
    prisma.cardAssignee.findMany({ where: { cardId }, select: { userId: true } }),
  ]);
  const set = new Set<string>();
  for (const w of watchers) set.add(w.userId);
  for (const a of assignees) set.add(a.userId);
  set.delete(excludeUserId);
  return [...set];
}

/** Add a watcher idempotently (used when someone comments on / is assigned to a card). */
export async function ensureWatching(cardId: string, userId: string): Promise<void> {
  try {
    await prisma.cardWatcher.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
  } catch (e) {
    console.error("[watch] failed", e);
  }
}

export type ActivityDTO = { id: string; actor: string; text: string; createdAt: string };

// Turn a stored (verb, meta) row into a human sentence. `names` resolves any
// user id referenced in meta.userId.
function activityText(verb: string, meta: Record<string, unknown>, names: Map<string, { name: string }>): string {
  const who = typeof meta.userId === "string" ? names.get(meta.userId)?.name ?? "someone" : "";
  switch (verb) {
    case "created": return "created the board";
    case "updated": return "updated board settings";
    case "column_created": return `added column “${meta.title ?? ""}”`;
    case "column_updated": return "reordered/renamed a column";
    case "column_deleted": return `deleted column “${meta.title ?? ""}”`;
    case "card_created": return "created this card";
    case "card_updated": return "updated this card";
    case "card_moved": return "moved this card";
    case "card_archived": return "archived this card";
    case "card_deleted": return "deleted a card";
    case "card_duplicated": return "duplicated a card";
    case "assigned": return `assigned ${who}`;
    case "unassigned": return `unassigned ${who}`;
    case "commented": return "commented";
    case "checklist_completed": return "completed all checklist items";
    case "label_created": return `created label “${meta.name ?? ""}”`;
    case "label_deleted": return "deleted a label";
    case "member_added": return `added ${who} to the board`;
    case "member_removed": return `removed ${who} from the board`;
    case "member_role_changed": return `changed ${who}'s role`;
    default: return verb.replace(/_/g, " ");
  }
}

async function formatActivity(
  rows: { id: string; actorId: string; verb: string; meta: string; createdAt: Date }[],
): Promise<ActivityDTO[]> {
  const metas = rows.map((r) => { try { return JSON.parse(r.meta); } catch { return {}; } });
  const refUserIds = metas.flatMap((m) => (typeof m.userId === "string" ? [m.userId] : []));
  const names = await nameMap([...rows.map((r) => r.actorId), ...refUserIds]);
  return rows.map((r, i) => ({
    id: r.id,
    actor: names.get(r.actorId)?.name ?? "Someone",
    text: activityText(r.verb, metas[i], names),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Recent activity for one card (member-scoped). */
export async function loadCardActivity(cardId: string, userId: string): Promise<ActivityDTO[] | null> {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } });
  if (!card || !(await boardAccess(card.boardId, userId))) return null;
  const rows = await prisma.activityLog.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return formatActivity(rows);
}

/** Recent activity across a whole board (member-scoped, paginated). */
export async function loadBoardActivity(
  boardId: string,
  userId: string,
  take = 50,
): Promise<ActivityDTO[] | null> {
  if (!(await boardAccess(boardId, userId))) return null;
  const rows = await prisma.activityLog.findMany({
    where: { boardId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return formatActivity(rows);
}

export type CommentDTO = { id: string; userId: string; author: string; body: string; createdAt: string; mine: boolean };

/** List a card's comments oldest-first (member-scoped). */
export async function loadCardComments(cardId: string, userId: string): Promise<CommentDTO[] | null> {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { boardId: true } });
  if (!card || !(await boardAccess(card.boardId, userId))) return null;
  // Blocking has to do something visible, or it is not a block (App Store
  // guideline 1.2): a blocked artist's comments disappear for the blocker, and
  // only for them — everyone else on the board still sees the thread intact.
  const blocked = (
    await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } })
  ).map((b) => b.blockedId);
  const rows = await prisma.comment.findMany({
    where: blocked.length ? { cardId, userId: { notIn: blocked } } : { cardId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const names = await nameMap(rows.map((r) => r.userId));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    author: names.get(r.userId)?.name ?? "Someone",
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    mine: r.userId === userId,
  }));
}

// ---- Dashboard -------------------------------------------------------------

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

/**
 * Which dashboard list a due date belongs in. Due dates are stored as noon UTC
 * on the chosen calendar day, so the stored UTC date *is* the calendar day. It
 * is compared with today in the artist's own timezone. Comparing instants
 * against the server's midnight (UTC on our hosts) moved cards between
 * "Due today" and "Overdue" hours early or late for anyone outside UTC.
 */
export function dueBucket(due: Date, today: string): "overdue" | "today" | "upcoming" | null {
  const day = due.toISOString().slice(0, 10);
  if (day < today) return "overdue";
  if (day === today) return "today";
  const in7 = new Date(Date.parse(`${today}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  return day <= in7 ? "upcoming" : null;
}

/** Personal project dashboard aggregated across all boards the user belongs to. */
export async function loadDashboard(userId: string): Promise<DashboardDTO> {
  const empty: DashboardDTO = { openCount: 0, completedCount: 0, dueToday: [], overdue: [], upcoming: [], boardProgress: [], recentBoards: [], workload: [] };
  const memberships = await prisma.boardMember.findMany({ where: { userId }, select: { boardId: true } });
  const boardIds = memberships.map((m) => m.boardId);
  if (boardIds.length === 0) return empty;

  const profile = await prisma.artistProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const today = todayKey(profile?.timezone || "UTC");

  // My assigned cards.
  const mine = await prisma.card.findMany({
    where: { archived: false, boardId: { in: boardIds }, assignees: { some: { userId } } },
    select: { id: true, boardId: true, title: true, dueDate: true, completion: true, board: { select: { title: true } } },
  });
  const lite = (c: (typeof mine)[number]): TaskLite => ({
    id: c.id, boardId: c.boardId, title: c.title, dueDate: c.dueDate?.toISOString() ?? null, boardTitle: c.board.title,
  });
  const open = mine.filter((c) => c.completion < 100);
  const byDue = (a: TaskLite, b: TaskLite) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  const inBucket = (b: "overdue" | "today" | "upcoming") => (c: (typeof open)[number]) => !!c.dueDate && dueBucket(c.dueDate, today) === b;
  const dueToday = open.filter(inBucket("today")).map(lite).sort(byDue);
  const overdue = open.filter(inBucket("overdue")).map(lite).sort(byDue);
  const upcoming = open.filter(inBucket("upcoming")).map(lite).sort(byDue);

  // Per-board progress.
  const boards = await prisma.board.findMany({ where: { id: { in: boardIds } }, select: { id: true, title: true, color: true } });
  const grouped = await prisma.card.groupBy({
    by: ["boardId"],
    where: { boardId: { in: boardIds }, archived: false },
    _count: { _all: true },
  });
  const doneGrouped = await prisma.card.groupBy({
    by: ["boardId"],
    where: { boardId: { in: boardIds }, archived: false, completion: { gte: 100 } },
    _count: { _all: true },
  });
  const totalMap = new Map(grouped.map((g) => [g.boardId, g._count._all]));
  const doneMap = new Map(doneGrouped.map((g) => [g.boardId, g._count._all]));
  const boardProgress = boards
    .map((b) => ({ id: b.id, title: b.title, color: b.color, total: totalMap.get(b.id) ?? 0, done: doneMap.get(b.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  // Recently active boards (by latest activity).
  const recentActivity = await prisma.activityLog.findMany({
    where: { boardId: { in: boardIds } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { boardId: true, createdAt: true },
  });
  const boardMap = new Map(boards.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const recentBoards: DashboardDTO["recentBoards"] = [];
  for (const a of recentActivity) {
    if (seen.has(a.boardId)) continue;
    const b = boardMap.get(a.boardId);
    if (!b) continue;
    seen.add(a.boardId);
    recentBoards.push({ id: b.id, title: b.title, color: b.color, when: a.createdAt.toISOString() });
    if (recentBoards.length >= 6) break;
  }

  // Team workload: open assigned cards per assignee across my boards.
  const openAssignees = await prisma.cardAssignee.findMany({
    where: { card: { boardId: { in: boardIds }, archived: false, completion: { lt: 100 } } },
    select: { userId: true },
  });
  const counts = new Map<string, number>();
  for (const a of openAssignees) counts.set(a.userId, (counts.get(a.userId) ?? 0) + 1);
  const names = await nameMap([...counts.keys()]);
  const workload = [...counts.entries()]
    .map(([uid, n]) => ({ userId: uid, name: names.get(uid)?.name ?? "?", open: n }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);

  return {
    openCount: open.length,
    completedCount: mine.filter((c) => c.completion >= 100).length,
    dueToday, overdue, upcoming, boardProgress, recentBoards, workload,
  };
}

// ---- Global search ---------------------------------------------------------

export type SearchResults = {
  boards: { id: string; title: string }[];
  cards: { id: string; boardId: string; title: string; boardTitle: string }[];
  labels: { id: string; boardId: string; name: string; color: string; boardTitle: string }[];
  comments: { cardId: string; boardId: string; snippet: string; boardTitle: string }[];
  attachments: { cardId: string; boardId: string; name: string; boardTitle: string }[];
  users: { userId: string; name: string; email: string }[];
};

/** Global search scoped to boards the user belongs to (authorization boundary). */
export async function searchProjects(userId: string, q: string): Promise<SearchResults> {
  const empty: SearchResults = { boards: [], cards: [], labels: [], comments: [], attachments: [], users: [] };
  const term = q.trim();
  if (term.length < 2) return empty;
  const memberships = await prisma.boardMember.findMany({ where: { userId }, select: { boardId: true } });
  const boardIds = memberships.map((m) => m.boardId);
  if (boardIds.length === 0) return empty;

  const boardTitles = new Map(
    (await prisma.board.findMany({ where: { id: { in: boardIds } }, select: { id: true, title: true } })).map((b) => [b.id, b.title]),
  );

  const [boards, cards, labels, comments, attachments, memberRows] = await Promise.all([
    prisma.board.findMany({
      where: { id: { in: boardIds }, OR: [{ title: ci(term) }, { description: ci(term) }] },
      select: { id: true, title: true }, take: 8,
    }),
    prisma.card.findMany({
      where: { boardId: { in: boardIds }, archived: false, OR: [{ title: ci(term) }, { description: ci(term) }] },
      select: { id: true, boardId: true, title: true }, take: 10,
    }),
    prisma.label.findMany({
      where: { boardId: { in: boardIds }, name: ci(term) },
      select: { id: true, boardId: true, name: true, color: true }, take: 8,
    }),
    prisma.comment.findMany({
      where: { body: ci(term), card: { boardId: { in: boardIds } } },
      select: { cardId: true, body: true, card: { select: { boardId: true } } }, take: 8, orderBy: { createdAt: "desc" },
    }),
    prisma.attachment.findMany({
      where: { name: ci(term), card: { boardId: { in: boardIds } } },
      select: { cardId: true, name: true, card: { select: { boardId: true } } }, take: 8,
    }),
    prisma.boardMember.findMany({
      where: { boardId: { in: boardIds }, user: { OR: [{ email: ci(term) }, { profile: { stageName: ci(term) } }] } },
      select: { userId: true, user: { select: { email: true, profile: { select: { stageName: true } } } } }, take: 20,
    }),
  ]);

  const seenU = new Set<string>();
  const users: SearchResults["users"] = [];
  for (const m of memberRows) {
    if (seenU.has(m.userId)) continue;
    seenU.add(m.userId);
    users.push({ userId: m.userId, name: m.user.profile?.stageName?.trim() || m.user.email.split("@")[0], email: m.user.email });
    if (users.length >= 8) break;
  }

  const snippet = (body: string) => {
    const i = body.toLowerCase().indexOf(term.toLowerCase());
    const s = Math.max(0, i - 30);
    return (s > 0 ? "…" : "") + body.slice(s, s + 80).replace(/\s+/g, " ").trim() + "…";
  };

  return {
    boards: boards.map((b) => ({ id: b.id, title: b.title })),
    cards: cards.map((c) => ({ id: c.id, boardId: c.boardId, title: c.title, boardTitle: boardTitles.get(c.boardId) ?? "" })),
    labels: labels.map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, color: l.color, boardTitle: boardTitles.get(l.boardId) ?? "" })),
    comments: comments.map((c) => ({ cardId: c.cardId, boardId: c.card.boardId, snippet: snippet(c.body), boardTitle: boardTitles.get(c.card.boardId) ?? "" })),
    attachments: attachments.map((a) => ({ cardId: a.cardId, boardId: a.card.boardId, name: a.name, boardTitle: boardTitles.get(a.card.boardId) ?? "" })),
    users,
  };
}

/**
 * Notify assignees/watchers of cards due within `withinHours`, once per card per
 * ~day. Idempotent via a lookback query (no schema field needed). Intended to be
 * driven by a scheduler (cron) hitting /api/cron/due-soon. Returns count sent.
 */
export async function notifyDueSoon(withinHours = 24): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + withinHours * 3_600_000);
  const dedupeSince = new Date(now.getTime() - 20 * 3_600_000);
  const cards = await prisma.card.findMany({
    where: { archived: false, completion: { lt: 100 }, dueDate: { gt: now, lte: until } },
    select: { id: true, boardId: true, title: true },
  });
  let sent = 0;
  for (const c of cards) {
    const link = `/boards/${c.boardId}?card=${c.id}`;
    for (const uid of await cardParticipants(c.id, "")) {
      const existing = await prisma.notification.findFirst({
        where: { userId: uid, type: "due", link, createdAt: { gt: dedupeSince } },
        select: { id: true },
      });
      if (existing) continue;
      await notify(uid, { type: "due", title: "Task due soon", body: c.title, link });
      sent++;
    }
  }
  return sent;
}

/** List a board's archived cards (for the archive panel). Member-scoped. */
export async function listArchivedCards(
  boardId: string,
  userId: string,
): Promise<{ id: string; title: string; columnTitle: string }[] | null> {
  const access = await boardAccess(boardId, userId);
  if (!access) return null;
  const cards = await prisma.card.findMany({
    where: { boardId, archived: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, column: { select: { title: true } } },
  });
  return cards.map((c) => ({ id: c.id, title: c.title, columnTitle: c.column.title }));
}
