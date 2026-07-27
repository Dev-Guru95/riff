"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CardModal } from "./CardModal";
import { MembersPanel, ArchivePanel, ActivityPanel } from "./BoardPanels";
import { templateFor } from "@/lib/board-templates";

// The card currently being dragged (module-level; all board components live in
// this file so a shared variable is simpler and typesafe vs. a window global).
let dragCardId: string | null = null;

// ---- Types (mirror BoardDTO from src/lib/boards.ts) ------------------------
type Cap = Record<string, boolean>;
type Label = { id: string; name: string; color: string };
type Assignee = { userId: string; name: string };
type Card = {
  id: string;
  columnId: string;
  title: string;
  description: string;
  orderIndex: number;
  priority: string | null;
  dueDate: string | null;
  startDate: string | null;
  completion: number;
  labels: Label[];
  assignees: Assignee[];
  checklist: { done: number; total: number };
  counts: { comments: number; attachments: number; checklists: number };
};
type Column = { id: string; title: string; orderIndex: number; cardTotal: number; cards: Card[] };
type Filter = { text: string; label: string; assignee: string; priority: string };

function cardMatches(card: Card, f: Filter): boolean {
  if (f.text) {
    const t = f.text.toLowerCase();
    if (!card.title.toLowerCase().includes(t) && !card.description.toLowerCase().includes(t)) return false;
  }
  if (f.label && !card.labels.some((l) => l.id === f.label)) return false;
  if (f.assignee && !card.assignees.some((a) => a.userId === f.assignee)) return false;
  if (f.priority && card.priority !== f.priority) return false;
  return true;
}
type Member = { userId: string; role: string; name: string; email: string };
type Board = {
  id: string;
  title: string;
  description: string;
  color: string;
  kind: string;
  archived: boolean;
  ownerId: string;
  role: string;
  can: Cap;
  members: Member[];
  labels: Label[];
  columns: Column[];
};

const PRIORITY_STYLE: Record<string, { dot: string; label: string }> = {
  low: { dot: "var(--muted)", label: "Low" },
  medium: { dot: "var(--accent)", label: "Medium" },
  high: { dot: "var(--warning)", label: "High" },
  urgent: { dot: "var(--brand-2)", label: "Urgent" },
};
const LABEL_VAR: Record<string, string> = {
  brand: "var(--brand)",
  "brand-2": "var(--brand-2)",
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  muted: "var(--muted)",
};

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function BoardView({ initial, currentUserId }: { initial: Board; currentUserId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [board, setBoard] = useState<Board>(initial);
  // Deep-link: /boards/[id]?card=<id> opens that card on mount (search results,
  // dashboard, and notifications all navigate here fresh). Lazy init avoids a
  // setState-in-effect and works regardless of whether the card is on the first
  // loaded page — the modal fetches its own detail by id.
  const [openCardId, setOpenCardId] = useState<string | null>(() => search.get("card"));
  const [showMembers, setShowMembers] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [filter, setFilter] = useState<Filter>({ text: "", label: "", assignee: "", priority: "" });
  const filterActive = !!(filter.text || filter.label || filter.assignee || filter.priority);
  const can = board.can;

  // Close the card modal and strip ?card= from the URL (client-only, no refetch).
  const closeCard = useCallback(() => {
    setOpenCardId(null);
    if (typeof window !== "undefined" && window.location.search.includes("card=")) {
      window.history.replaceState(null, "", `/boards/${board.id}`);
    }
  }, [board.id]);

  // Latest board snapshot for callbacks that must read current state without being
  // recreated (and re-subscribing effects) on every keystroke/drag.
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }); // keep latest board for callbacks/effects

  // Re-fetch authoritative board state (source of truth for ordering), preserving
  // how many cards each column had lazily loaded so "Load more" doesn't collapse.
  const reload = useCallback(async () => {
    const prevDepth = new Map(boardRef.current.columns.map((c) => [c.id, c.cards.length]));
    const { ok, data } = await api(`/api/boards/${boardRef.current.id}`, "GET");
    if (!ok || !data.board) return;
    const fresh = data.board as Board;
    await Promise.all(
      fresh.columns.map(async (c) => {
        const want = prevDepth.get(c.id) ?? 0;
        let guard = 0;
        while (c.cards.length < want && c.cards.length < c.cardTotal && guard++ < 40) {
          const r = await api(`/api/columns/${c.id}/cards?offset=${c.cards.length}`, "GET");
          if (!r.ok || !r.data.cards?.length) break;
          c.cards.push(...r.data.cards);
        }
      }),
    );
    setBoard(fresh);
  }, []);

  // While a filter is active, load every remaining page so client-side filtering
  // and the "N match" count see the whole board, not just the first page.
  useEffect(() => {
    if (!filterActive) return;
    let cancelled = false;
    (async () => {
      for (const col of boardRef.current.columns) {
        let guard = 0;
        while (!cancelled && guard++ < 40) {
          const cur = boardRef.current.columns.find((x) => x.id === col.id);
          if (!cur || cur.cards.length >= cur.cardTotal) break;
          const r = await api(`/api/columns/${col.id}/cards?offset=${cur.cards.length}`, "GET");
          if (!r.ok || !r.data.cards?.length) break;
          setBoard((b) => ({
            ...b,
            columns: b.columns.map((x) => (x.id === col.id ? { ...x, cards: [...x.cards, ...r.data.cards] } : x)),
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [filterActive]);


  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <BoardHeader
        board={board}
        can={can}
        onReload={reload}
        router={router}
        onMembers={() => setShowMembers(true)}
        onArchive={() => setShowArchive(true)}
        onActivity={() => setShowActivity(true)}
      />

      <FilterBar board={board} filter={filter} setFilter={setFilter} active={filterActive} />

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4">
        <div className="flex gap-3 h-full items-start min-w-max">
          {board.columns.map((col) => (
            <ColumnView
              key={col.id}
              board={board}
              col={col}
              can={can}
              setBoard={setBoard}
              reload={reload}
              onOpenCard={setOpenCardId}
              filter={filter}
              filterActive={filterActive}
            />
          ))}
          {can.manageColumns && <AddColumn boardId={board.id} onReload={reload} />}
        </div>
      </div>

      {openCardId && (
        <CardModal
          cardId={openCardId}
          boardId={board.id}
          boardLabels={board.labels}
          members={board.members}
          columns={board.columns.map((c) => ({ id: c.id, title: c.title }))}
          currentUserId={currentUserId}
          can={can}
          onClose={closeCard}
          onReload={reload}
        />
      )}
      {showMembers && (
        <MembersPanel
          boardId={board.id}
          members={board.members}
          ownerId={board.ownerId}
          onClose={() => setShowMembers(false)}
          onReload={reload}
        />
      )}
      {showArchive && (
        <ArchivePanel boardId={board.id} onClose={() => setShowArchive(false)} onReload={reload} />
      )}
      {showActivity && (
        <ActivityPanel boardId={board.id} onClose={() => setShowActivity(false)} />
      )}
    </div>
  );
}

// ---- Filter bar ------------------------------------------------------------
function FilterBar({
  board,
  filter,
  setFilter,
  active,
}: {
  board: Board;
  filter: Filter;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
  active: boolean;
}) {
  const set = (k: keyof Filter, v: string) => setFilter((f) => ({ ...f, [k]: v }));
  const sel = "bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[var(--brand)]";
  return (
    <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
      <input
        value={filter.text}
        onChange={(e) => set("text", e.target.value)}
        placeholder="Filter cards…"
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--brand)] text-xs w-40"
      />
      <select value={filter.label} onChange={(e) => set("label", e.target.value)} className={sel}>
        <option value="">All labels</option>
        {board.labels.map((l) => <option key={l.id} value={l.id}>{l.name || l.color}</option>)}
      </select>
      <select value={filter.assignee} onChange={(e) => set("assignee", e.target.value)} className={sel}>
        <option value="">Any assignee</option>
        {board.members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
      <select value={filter.priority} onChange={(e) => set("priority", e.target.value)} className={sel}>
        <option value="">Any priority</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {active && (
        <button className="btn btn-ghost text-xs py-1 px-2" onClick={() => setFilter({ text: "", label: "", assignee: "", priority: "" })}>
          Clear filters
        </button>
      )}
      {active && <span className="text-xs text-[var(--muted)]">Drag disabled while filtering</span>}
    </div>
  );
}

// ---- Header ----------------------------------------------------------------
function BoardHeader({
  board,
  can,
  onReload,
  router,
  onMembers,
  onArchive,
  onActivity,
}: {
  board: Board;
  can: Cap;
  onReload: () => void;
  router: ReturnType<typeof useRouter>;
  onMembers: () => void;
  onArchive: () => void;
  onActivity: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);

  async function saveTitle() {
    setEditing(false);
    if (title.trim() && title !== board.title) {
      await api(`/api/boards/${board.id}`, "PATCH", { title: title.trim() });
      onReload();
    } else {
      setTitle(board.title);
    }
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <Link href="/boards" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Projects</Link>
      <span className="text-lg" title={templateFor(board.kind).name}>{templateFor(board.kind).icon}</span>
      {editing && can.manageBoard ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitle(board.title); setEditing(false); } }}
          className="text-xl font-bold bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-0.5 outline-none focus:border-[var(--brand)]"
        />
      ) : (
        <h1
          className={`text-xl font-bold ${can.manageBoard ? "cursor-text hover:text-[var(--brand)]" : ""}`}
          onClick={() => can.manageBoard && setEditing(true)}
          title={can.manageBoard ? "Click to rename" : undefined}
        >
          {board.title}
        </h1>
      )}
      {board.archived && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--warning)]">Archived</span>}

      <div className="ml-auto flex items-center gap-2">
        <button className="flex -space-x-2 items-center hover:opacity-80" onClick={onMembers} title="Board members">
          {board.members.slice(0, 5).map((m) => (
            <span
              key={m.userId}
              title={`${m.name} · ${m.role}`}
              className="h-7 w-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[10px] font-bold"
            >
              {initials(m.name)}
            </span>
          ))}
          {board.members.length > 5 && (
            <span className="h-7 w-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[10px]">
              +{board.members.length - 5}
            </span>
          )}
        </button>
        {can.manageMembers && (
          <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={onMembers}>Members</button>
        )}
        <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={onActivity}>Activity</button>
        <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={onArchive}>Archived</button>
        {can.deleteBoard && (
          <button
            className="btn btn-ghost text-xs py-1.5 px-3"
            onClick={async () => {
              if (!confirm("Delete this board and everything in it? This cannot be undone.")) return;
              const { ok } = await api(`/api/boards/${board.id}`, "DELETE");
              if (ok) router.push("/boards");
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Column ----------------------------------------------------------------
function ColumnView({
  board,
  col,
  can,
  setBoard,
  reload,
  onOpenCard,
  filter,
  filterActive,
}: {
  board: Board;
  col: Column;
  can: Cap;
  setBoard: React.Dispatch<React.SetStateAction<Board>>;
  reload: () => void;
  onOpenCard: (id: string) => void;
  filter: Filter;
  filterActive: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(col.title);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const visible = filterActive ? col.cards.filter((c) => cardMatches(c, filter)) : col.cards;
  const canDrag = can.editCards && !filterActive; // dragging disabled while filtering

  async function loadMore() {
    setLoadingMore(true);
    const { ok, data } = await api(`/api/columns/${col.id}/cards?offset=${col.cards.length}`, "GET");
    setLoadingMore(false);
    if (ok && data.cards?.length) {
      setBoard((b) => ({
        ...b,
        columns: b.columns.map((c) => (c.id === col.id ? { ...c, cards: [...c.cards, ...data.cards] } : c)),
      }));
    }
  }

  async function rename() {
    setRenaming(false);
    if (title.trim() && title !== col.title) {
      await api(`/api/columns/${col.id}`, "PATCH", { title: title.trim() });
      reload();
    } else setTitle(col.title);
  }

  async function del() {
    if (!confirm(`Delete column "${col.title}" and its cards?`)) return;
    await api(`/api/columns/${col.id}`, "DELETE");
    reload();
  }

  // Optimistically move a card in local state, then persist + reconcile.
  async function performDrop(index: number) {
    const cardId = dragCardId;
    if (!cardId) return;
    setOverIndex(null);

    // If dragging within this same column, note the card's current index so we can
    // correct the drop index after removal (removing an item above the target
    // shifts every later index down by one).
    const srcCol = board.columns.find((c) => c.cards.some((cd) => cd.id === cardId));
    const sameColOrigIndex = srcCol && srcCol.id === col.id ? srcCol.cards.findIndex((cd) => cd.id === cardId) : -1;

    // Optimistic: remove the card everywhere, then insert into this column.
    let moved: Card | undefined;
    const cols = board.columns.map((c) => ({
      ...c,
      cards: c.cards.filter((cd) => { if (cd.id === cardId) { moved = cd; return false; } return true; }),
    }));
    if (!moved) return;
    const target = cols.find((c) => c.id === col.id)!;

    let insert = index;
    if (sameColOrigIndex !== -1 && sameColOrigIndex < index) insert -= 1;
    const optimisticIdx = Math.max(0, Math.min(insert, target.cards.length));

    // Dropping at the end of a paginated column (unloaded cards below) → append to
    // the true end server-side; otherwise the post-removal index is authoritative.
    const droppedAtEnd = index >= col.cards.length;
    const paginated = col.cardTotal > col.cards.length;
    const toIndex = droppedAtEnd && paginated ? col.cardTotal : optimisticIdx;

    target.cards.splice(optimisticIdx, 0, { ...moved, columnId: col.id });
    setBoard({ ...board, columns: cols });
    await api(`/api/cards/${cardId}/move`, "POST", { toColumnId: col.id, toIndex });
    reload(); // reconcile with server truth (also reverts on failure)
  }

  return (
    <div
      className="w-72 shrink-0 flex flex-col max-h-full card bg-[var(--surface)]"
      onDragOver={(e) => { if (canDrag) { e.preventDefault(); if (overIndex === null) setOverIndex(col.cards.length); } }}
      onDrop={(e) => { if (!canDrag) return; e.preventDefault(); performDrop(overIndex ?? col.cards.length); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIndex(null); }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        {renaming && can.manageColumns ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") { setTitle(col.title); setRenaming(false); } }}
            className="flex-1 text-sm font-semibold bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-0.5 outline-none"
          />
        ) : (
          <span
            className={`flex-1 text-sm font-semibold ${can.manageColumns ? "cursor-text" : ""}`}
            onClick={() => can.manageColumns && setRenaming(true)}
          >
            {col.title}
          </span>
        )}
        <span className="text-xs text-[var(--muted)]">{filterActive ? `${visible.length} match` : col.cardTotal}</span>
        {can.manageColumns && (
          <div className="relative">
            <button className="text-[var(--muted)] hover:text-[var(--foreground)] px-1" onClick={() => setMenu((m) => !m)}>⋯</button>
            {menu && (
              <div className="absolute right-0 top-6 z-10 card bg-[var(--surface-2)] py-1 text-sm w-32" onMouseLeave={() => setMenu(false)}>
                <button className="block w-full text-left px-3 py-1.5 hover:bg-[var(--border)]" onClick={() => { setMenu(false); setRenaming(true); }}>Rename</button>
                <button className="block w-full text-left px-3 py-1.5 hover:bg-[var(--border)] text-[var(--brand-2)]" onClick={() => { setMenu(false); del(); }}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[3rem]">
        {visible.map((card, i) => (
          <div key={card.id}>
            {overIndex === i && <div className="h-0.5 bg-[var(--brand)] rounded-full mb-2" />}
            <CardTile
              card={card}
              canDrag={canDrag}
              onOpen={() => onOpenCard(card.id)}
              onDragOverIndex={() => setOverIndex(i)}
            />
          </div>
        ))}
        {overIndex === visible.length && <div className="h-0.5 bg-[var(--brand)] rounded-full" />}
        {visible.length === 0 && overIndex === null && (
          <p className="text-xs text-[var(--muted)] text-center py-4">{filterActive ? "No matches" : "No cards"}</p>
        )}
        {!filterActive && col.cardTotal > col.cards.length && (
          <button className="w-full text-xs text-[var(--muted)] hover:text-[var(--foreground)] py-2" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load ${col.cardTotal - col.cards.length} more`}
          </button>
        )}
      </div>

      {can.editCards && !filterActive && <AddCard columnId={col.id} onReload={reload} />}
    </div>
  );
}

// ---- Card tile -------------------------------------------------------------
function CardTile({
  card,
  canDrag,
  onOpen,
  onDragOverIndex,
}: {
  card: Card;
  canDrag: boolean;
  onOpen: () => void;
  onDragOverIndex: () => void;
}) {
  const pr = card.priority ? PRIORITY_STYLE[card.priority] : null;
  const overdue = isOverdue(card.dueDate);
  return (
    <div
      draggable={canDrag}
      onDragStart={() => { dragCardId = card.id; }}
      onDragEnd={() => { dragCardId = null; }}
      onDragOver={(e) => { e.preventDefault(); onDragOverIndex(); }}
      onClick={onOpen}
      className="card bg-[var(--surface-2)] p-2.5 cursor-pointer hover:border-[var(--brand)] transition"
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map((l) => (
            <span key={l.id} className="h-1.5 w-8 rounded-full" style={{ background: LABEL_VAR[l.color] ?? "var(--brand)" }} title={l.name} />
          ))}
        </div>
      )}
      <div className="text-sm">{card.title}</div>
      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--muted)] flex-wrap">
        {pr && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: pr.dot }} />{pr.label}</span>}
        {card.dueDate && (
          <span className={overdue ? "text-[var(--brand-2)] font-medium" : ""}>📅 {fmtDate(card.dueDate)}</span>
        )}
        {card.completion > 0 && <span>{card.completion}%</span>}
        {card.checklist.total > 0 && (
          <span className={card.checklist.done === card.checklist.total ? "text-[var(--success)]" : ""}>
            ☑ {card.checklist.done}/{card.checklist.total}
          </span>
        )}
        {card.counts.comments > 0 && <span>💬 {card.counts.comments}</span>}
        {card.counts.attachments > 0 && <span>📎 {card.counts.attachments}</span>}
        {card.assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1">
            {card.assignees.slice(0, 3).map((a) => (
              <span key={a.userId} title={a.name} className="h-5 w-5 rounded-full bg-[var(--surface)] border border-[var(--border)] grid place-items-center text-[9px] font-bold">
                {initials(a.name)}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Add card / column composers ------------------------------------------
function AddCard({ columnId, onReload }: { columnId: string; onReload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const t = title.trim();
    if (!t) { setAdding(false); return; }
    setTitle("");
    await api(`/api/columns/${columnId}/cards`, "POST", { title: t });
    onReload();
    setTimeout(() => ref.current?.focus(), 0);
  }

  if (!adding) {
    return (
      <button className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] text-left px-3 py-2" onClick={() => setAdding(true)}>
        + Add a card
      </button>
    );
  }
  return (
    <div className="p-2">
      <textarea
        ref={ref}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setAdding(false); setTitle(""); } }}
        rows={2}
        placeholder="Card title…"
        className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--brand)] resize-none"
      />
      <div className="flex gap-2 mt-1">
        <button className="btn btn-primary text-xs py-1.5 px-3" onClick={submit}>Add</button>
        <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={() => { setAdding(false); setTitle(""); }}>Cancel</button>
      </div>
    </div>
  );
}

function AddColumn({ boardId, onReload }: { boardId: string; onReload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function submit() {
    const t = title.trim();
    if (!t) { setAdding(false); return; }
    setTitle("");
    setAdding(false);
    await api(`/api/boards/${boardId}/columns`, "POST", { title: t });
    onReload();
  }

  if (!adding) {
    return (
      <button className="w-72 shrink-0 card bg-[var(--surface)]/50 border-dashed p-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--brand)] transition text-left" onClick={() => setAdding(true)}>
        + Add column
      </button>
    );
  }
  return (
    <div className="w-72 shrink-0 card p-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setTitle(""); } }}
        placeholder="Column name…"
        className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--brand)]"
      />
      <div className="flex gap-2 mt-1">
        <button className="btn btn-primary text-xs py-1.5 px-3" onClick={submit}>Add</button>
        <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={() => { setAdding(false); setTitle(""); }}>Cancel</button>
      </div>
    </div>
  );
}
