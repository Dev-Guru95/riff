"use client";

import { useEffect, useState, useCallback } from "react";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { renderMarkdown } from "@/lib/markdown";
import { ReportControl } from "@/components/ReportControl";

type Cap = Record<string, boolean>;
type Label = { id: string; name: string; color: string };
type Member = { userId: string; role: string; name: string };
type ChecklistItem = { id: string; text: string; done: boolean };
type Checklist = { id: string; title: string; items: ChecklistItem[] };
type Comment = { id: string; userId: string; author: string; body: string; createdAt: string; mine: boolean };
type Act = { id: string; actor: string; text: string; createdAt: string };
type Detail = {
  id: string;
  boardId: string;
  title: string;
  description: string;
  priority: string | null;
  dueDate: string | null;
  completion: number;
  labelIds: string[];
  assignees: { userId: string; name: string }[];
  checklists: Checklist[];
  attachments: { id: string; name: string; url: string; mime: string; size: number }[];
  watching: boolean;
  watchersCount: number;
};

const mentionHandle = (name: string) => name.replace(/\s+/g, "");
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const COLOR_SWATCHES = ["brand", "brand-2", "accent", "success", "warning", "muted"];
const LABEL_VAR: Record<string, string> = {
  brand: "var(--brand)", "brand-2": "var(--brand-2)", accent: "var(--accent)",
  success: "var(--success)", warning: "var(--warning)", muted: "var(--muted)",
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function CardModal({
  cardId,
  boardId,
  boardLabels,
  members,
  columns,
  currentUserId,
  can,
  onClose,
  onReload,
}: {
  cardId: string;
  boardId: string;
  boardLabels: Label[];
  members: Member[];
  columns: { id: string; title: string }[];
  currentUserId: string;
  can: Cap;
  onClose: () => void;
  onReload: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [labels, setLabels] = useState<Label[]>(boardLabels);
  // scalar edit state (initialised once)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [completion, setCompletion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [init, setInit] = useState(false);
  const editable = can.editCards;

  const refetch = useCallback(async () => {
    const { ok, data } = await api(`/api/cards/${cardId}`, "GET");
    if (ok && data.card) {
      setDetail(data.card);
      if (!init) {
        setTitle(data.card.title);
        setDescription(data.card.description);
        setPriority(data.card.priority ?? "");
        setDue(data.card.dueDate ? data.card.dueDate.slice(0, 10) : "");
        setCompletion(data.card.completion);
        setInit(true);
      }
    }
  }, [cardId, init]);

  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Act[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    const { ok, data } = await api(`/api/cards/${cardId}/comments`, "GET");
    if (ok) setComments(data.comments ?? []);
  }, [cardId]);
  const loadActivity = useCallback(async () => {
    const { ok, data } = await api(`/api/cards/${cardId}/activity`, "GET");
    if (ok) setActivity(data.activity ?? []);
  }, [cardId]);

  // Split so comments/activity load once (stable deps) rather than re-firing when
  // `refetch` identity changes after the init field-population. IIFEs keep the
  // setState calls out of the effect body (deferred, not synchronous).
  useEffect(() => { (async () => { await refetch(); })(); }, [refetch]);
  useEffect(() => { (async () => { await loadComments(); await loadActivity(); })(); }, [loadComments, loadActivity]);

  function close() { onReload(); onClose(); }

  async function toggleWatch() {
    if (!detail) return;
    await api(`/api/cards/${cardId}/watch`, detail.watching ? "DELETE" : "POST");
    refetch();
  }

  async function postComment() {
    const t = commentText.trim();
    if (!t) return;
    setPosting(true);
    await api(`/api/cards/${cardId}/comments`, "POST", { body: t });
    setPosting(false);
    setCommentText("");
    loadComments();
    loadActivity();
    refetch(); // watcher count may change (auto-watch)
  }
  async function deleteComment(cid: string) {
    await api(`/api/comments/${cid}`, "DELETE");
    loadComments();
  }
  function mention(name: string) {
    setCommentText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${mentionHandle(name)} `);
  }

  async function saveCore() {
    setSaving(true);
    await api(`/api/cards/${cardId}`, "PATCH", {
      title: title.trim() || detail?.title,
      description,
      priority: priority || null,
      dueDate: due ? new Date(due + "T12:00:00.000Z").toISOString() : null,
      completion,
    });
    setSaving(false);
    onReload();
  }

  async function toggleLabel(labelId: string, attached: boolean) {
    if (attached) await api(`/api/cards/${cardId}/labels/${labelId}`, "DELETE");
    else await api(`/api/cards/${cardId}/labels`, "POST", { labelId });
    refetch();
    onReload();
  }

  async function createLabel(name: string, color: string) {
    const { ok, data } = await api(`/api/boards/${boardId}/labels`, "POST", { name, color });
    if (ok && data.id) {
      setLabels((ls) => [...ls, { id: data.id, name: data.name, color: data.color }]);
      await api(`/api/cards/${cardId}/labels`, "POST", { labelId: data.id });
      refetch();
      onReload();
    }
  }

  async function toggleAssignee(userId: string, assigned: boolean) {
    if (assigned) await api(`/api/cards/${cardId}/assignees/${userId}`, "DELETE");
    else await api(`/api/cards/${cardId}/assignees`, "POST", { userId });
    refetch();
    onReload();
  }

  async function addChecklist() {
    await api(`/api/cards/${cardId}/checklists`, "POST", { title: "Checklist" });
    refetch();
  }
  async function addItem(checklistId: string, text: string) {
    await api(`/api/checklists/${checklistId}/items`, "POST", { text });
    refetch();
  }
  async function toggleItem(itemId: string, done: boolean) {
    await api(`/api/checklist-items/${itemId}`, "PATCH", { done: !done });
    refetch();
    onReload();
  }
  async function deleteItem(itemId: string) {
    await api(`/api/checklist-items/${itemId}`, "DELETE");
    refetch();
    onReload();
  }
  async function deleteChecklist(id: string) {
    await api(`/api/checklists/${id}`, "DELETE");
    refetch();
    onReload();
  }

  async function duplicate() {
    await api(`/api/cards/${cardId}/duplicate`, "POST");
    close();
  }
  async function archive() {
    await api(`/api/cards/${cardId}`, "PATCH", { archived: true });
    close();
  }
  async function del() {
    if (!confirm("Permanently delete this card?")) return;
    await api(`/api/cards/${cardId}`, "DELETE");
    close();
  }

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  async function uploadAttachment(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/uploads", { method: "POST", body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) { setUploadErr(upData.error ?? "Upload failed"); return; }
      const res = await api(`/api/cards/${cardId}/attachments`, "POST", { url: upData.url, name: file.name, mime: file.type, size: upData.size ?? file.size });
      if (!res.ok) { setUploadErr(res.data.error ?? "Couldn't attach file"); return; }
      refetch();
      onReload();
    } finally {
      setUploading(false);
    }
  }
  async function deleteAttachment(id: string) {
    await api(`/api/attachments/${id}`, "DELETE");
    refetch();
    onReload();
  }
  // Touch-friendly alternative to drag-and-drop: move the card to another column (appended).
  async function moveTo(columnId: string) {
    await api(`/api/cards/${cardId}/move`, "POST", { toColumnId: columnId, toIndex: 9999 });
    close();
  }
  const humanSize = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  const attachedSet = new Set(detail?.labelIds ?? []);
  const assignedSet = new Set(detail?.assignees.map((a) => a.userId) ?? []);
  const clItems = detail?.checklists.flatMap((c) => c.items) ?? [];
  const clDone = clItems.filter((i) => i.done).length;
  const clPct = clItems.length ? Math.round((clDone / clItems.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex justify-end" onClick={close}>
      <div className="w-full max-w-lg h-full bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm text-[var(--muted)]">Card details</h2>
          <div className="flex items-center gap-2">
            {detail && (
              <button
                onClick={toggleWatch}
                className={`text-xs py-1.5 px-3 rounded-lg border transition ${detail.watching ? "border-[var(--brand)] bg-[var(--brand)]/20" : "border-[var(--border)] text-[var(--muted)]"}`}
                title={detail.watching ? "You're following this card" : "Follow this card"}
              >
                {detail.watching ? "👁 Watching" : "👁 Watch"}{detail.watchersCount > 0 ? ` · ${detail.watchersCount}` : ""}
              </button>
            )}
            <button className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={close}>✕</button>
          </div>
        </div>

        {!detail ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <>
            <input
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveCore}
              className="w-full text-lg font-semibold bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand)] outline-none pb-1 mb-3 disabled:opacity-70"
            />

            {editable && columns.length > 1 && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-[var(--muted)]">Move to</span>
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) moveTo(e.target.value); }}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--brand)]"
                >
                  <option value="">choose column…</option>
                  {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            )}

            {/* Labels */}
            <Section title="Labels">
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const on = attachedSet.has(l.id);
                  return (
                    <button
                      key={l.id}
                      disabled={!editable}
                      onClick={() => toggleLabel(l.id, on)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${on ? "border-transparent text-white" : "border-[var(--border)] text-[var(--muted)]"}`}
                      style={on ? { background: LABEL_VAR[l.color] } : undefined}
                    >
                      {l.name || l.color}
                    </button>
                  );
                })}
                {can.manageLabels && <NewLabel onCreate={createLabel} />}
              </div>
            </Section>

            {/* Assignees */}
            <Section title="Assignees">
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = assignedSet.has(m.userId);
                  // Same rule as POST/DELETE /api/cards/[id]/assignees: yourself needs
                  // editCards, anyone else needs assignOthers.
                  const canToggle = m.userId === currentUserId ? can.editCards : can.assignOthers;
                  return (
                    <button
                      key={m.userId}
                      disabled={!canToggle}
                      onClick={() => toggleAssignee(m.userId, on)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${on ? "border-[var(--brand)] bg-[var(--brand)]/20 text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted)]"} disabled:opacity-40`}
                    >
                      {on ? "✓ " : ""}{m.name}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Priority + due */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label>Priority</Label>
                <select value={priority} disabled={!editable} onChange={(e) => { setPriority(e.target.value); }} onBlur={saveCore}
                  className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none focus:border-[var(--brand)]">
                  <option value="">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <Label>Due date</Label>
                <input type="date" value={due} disabled={!editable} onChange={(e) => setDue(e.target.value)} onBlur={saveCore}
                  className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-2 outline-none focus:border-[var(--brand)]" />
              </div>
            </div>

            {/* Description */}
            <Section title="Description">
              <MarkdownEditor value={description} onChange={setDescription} disabled={!editable} placeholder="Add more detail…" />
              {editable && (
                <button className="btn btn-ghost text-xs py-1.5 px-3 mt-2" onClick={saveCore} disabled={saving}>
                  {saving ? "Saving…" : "Save description"}
                </button>
              )}
            </Section>

            {/* Completion */}
            <Section title={`Completion — ${completion}%`}>
              <input type="range" min={0} max={100} step={5} value={completion} disabled={!editable}
                onChange={(e) => setCompletion(Number(e.target.value))} onMouseUp={saveCore} onTouchEnd={saveCore}
                className="w-full accent-[var(--brand)]" />
            </Section>

            {/* Checklists */}
            <Section title={`Checklists${clItems.length ? ` — ${clDone}/${clItems.length}` : ""}`}>
              {clItems.length > 0 && (
                <div className="progress-track h-1.5 w-full mb-3"><div className="progress-fill" style={{ width: `${clPct}%` }} /></div>
              )}
              {detail.checklists.map((cl) => (
                <ChecklistBlock
                  key={cl.id}
                  checklist={cl}
                  editable={editable}
                  onAddItem={(t) => addItem(cl.id, t)}
                  onToggle={toggleItem}
                  onDeleteItem={deleteItem}
                  onDelete={() => deleteChecklist(cl.id)}
                />
              ))}
              {editable && (
                <button className="btn btn-ghost text-xs py-1.5 px-3 mt-1" onClick={addChecklist}>+ Add checklist</button>
              )}
            </Section>

            {/* Attachments */}
            <Section title={`Attachments${detail.attachments.length ? ` — ${detail.attachments.length}` : ""}`}>
              <div className="space-y-1.5 mb-2">
                {detail.attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm card bg-[var(--surface-2)] px-2.5 py-1.5 group">
                    <span>📎</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:text-[var(--brand)]">{a.name}</a>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">{humanSize(a.size)}</span>
                    {editable && (
                      <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => deleteAttachment(a.id)}>✕</button>
                    )}
                  </div>
                ))}
                {detail.attachments.length === 0 && <p className="text-xs text-[var(--muted)]">No attachments.</p>}
              </div>
              {editable && (
                <label className="btn btn-ghost text-xs py-1.5 px-3 cursor-pointer inline-block">
                  {uploading ? "Uploading…" : "+ Add attachment"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = ""; }}
                  />
                </label>
              )}
              {uploadErr && <p className="text-xs text-[var(--brand-2)] mt-1">{uploadErr}</p>}
            </Section>

            {/* Actions */}
            {editable && (
              <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--border)]">
                <button className="btn btn-ghost text-sm" onClick={duplicate}>Duplicate</button>
                <button className="btn btn-ghost text-sm" onClick={archive}>Archive</button>
                {can.manageColumns && <button className="btn btn-ghost text-sm text-[var(--brand-2)] ml-auto" onClick={del}>Delete</button>}
              </div>
            )}

            {/* Comments */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <Section title="Comments">
                <div className="space-y-3 mb-3">
                  {comments.map((c) => (
                    <div key={c.id} className="group">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="h-5 w-5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[9px] font-bold">
                          {c.author.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs font-medium">{c.author}</span>
                        <span className="text-xs text-[var(--muted)]">{fmtTime(c.createdAt)}</span>
                        {c.mine ? (
                          <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)] ml-auto" onClick={() => deleteComment(c.id)}>Delete</button>
                        ) : (
                          // Report + block on anyone else's comment (App Store
                          // guideline 1.2). Blocking filters their comments
                          // server-side, so reload the card afterwards.
                          <span className="ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <ReportControl
                              targetType="comment"
                              targetId={c.id}
                              title="Report this comment"
                              authorId={c.userId}
                              authorName={c.author}
                              onBlocked={() => void loadComments()}
                              className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)]"
                            />
                          </span>
                        )}
                      </div>
                      <div className="markdown-body text-sm pl-7" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
                    </div>
                  ))}
                  {comments.length === 0 && <p className="text-xs text-[var(--muted)]">No comments yet.</p>}
                </div>
                {can.comment && (
                  <>
                    <MarkdownEditor value={commentText} onChange={setCommentText} rows={3} placeholder="Write a comment… use @name to mention" />
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      <span className="text-xs text-[var(--muted)]">Mention:</span>
                      {members.filter((m) => m.userId !== currentUserId).slice(0, 6).map((m) => (
                        <button key={m.userId} onClick={() => mention(m.name)} className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-2)] hover:bg-[var(--border)]">@{mentionHandle(m.name)}</button>
                      ))}
                    </div>
                    <button className="btn btn-primary text-xs py-1.5 px-3 mt-2" onClick={postComment} disabled={posting}>{posting ? "Posting…" : "Comment"}</button>
                  </>
                )}
              </Section>

              {/* Activity */}
              <Section title="Activity">
                <div className="space-y-2">
                  {activity.map((a) => (
                    <div key={a.id} className="text-xs text-[var(--muted)] flex gap-2">
                      <span className="font-medium text-[var(--foreground)]">{a.actor}</span>
                      <span className="flex-1">{a.text}</span>
                      <span className="whitespace-nowrap">{fmtTime(a.createdAt)}</span>
                    </div>
                  ))}
                  {activity.length === 0 && <p className="text-xs text-[var(--muted)]">No activity yet.</p>}
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-[var(--muted)] mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-[var(--muted)] mb-1">{children}</label>;
}

function NewLabel({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("brand");
  if (!open) return <button className="text-xs px-2 py-1 rounded-full border border-dashed border-[var(--border)] text-[var(--muted)]" onClick={() => setOpen(true)}>+ label</button>;
  return (
    <div className="w-full card p-2 mt-1">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Label name" maxLength={40}
        className="w-full text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 outline-none mb-2" />
      <div className="flex gap-1.5 mb-2">
        {COLOR_SWATCHES.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`h-5 w-5 rounded-full ${color === c ? "ring-2 ring-white" : ""}`} style={{ background: LABEL_VAR[c] }} />
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs py-1 px-2" onClick={() => { onCreate(name.trim(), color); setOpen(false); setName(""); }}>Add</button>
        <button className="btn btn-ghost text-xs py-1 px-2" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function ChecklistBlock({
  checklist,
  editable,
  onAddItem,
  onToggle,
  onDeleteItem,
  onDelete,
}: {
  checklist: Checklist;
  editable: boolean;
  onAddItem: (text: string) => void;
  onToggle: (itemId: string, done: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{checklist.title}</span>
        {editable && <button className="text-xs text-[var(--muted)] hover:text-[var(--brand-2)]" onClick={onDelete}>Delete</button>}
      </div>
      <div className="space-y-1 mt-1">
        {checklist.items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={it.done} disabled={!editable} onChange={() => onToggle(it.id, it.done)} className="accent-[var(--brand)]" />
            <span className={`text-sm flex-1 ${it.done ? "line-through text-[var(--muted)]" : ""}`}>{it.text}</span>
            {editable && <button className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--brand-2)]" onClick={() => onDeleteItem(it.id)}>✕</button>}
          </div>
        ))}
      </div>
      {editable && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onAddItem(text.trim()); setText(""); } }}
          placeholder="Add an item + Enter"
          className="w-full text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 outline-none mt-1.5 focus:border-[var(--brand)]"
        />
      )}
    </div>
  );
}
