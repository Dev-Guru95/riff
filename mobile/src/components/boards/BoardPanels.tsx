// The web's board drawers (BoardPanels.tsx + the header's settings), as native
// sheets: members, labels, activity, archived cards and board settings.
// Every write is permission-checked by the server; these only hide controls the
// caller's BoardCapabilities say they can't use.

import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { Button, Card, Divider, EmptyState, Field, Icon, QueryView, Skeleton, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { UI_COLORS, type BoardRole } from "@/lib/constants";
import { colors, radius, TOUCH } from "@/theme/tokens";
import type { ActivityDTO, ActivityResponse, ArchiveResponse, BoardDTO, MemberSearchResponse } from "@/types/boards";
import { MY_TASKS_PATH } from "./MyTasks";
import { Sheet, useActionSheet } from "./Sheet";
import { useBoardAction } from "./useBoardAction";
import { Initials, SelectField } from "./bits";
import { ASSIGNABLE_ROLES, fmtTime, labelColor, ROLE_RANK } from "./utils";

// ---- Shared bits -----------------------------------------------------------

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }} accessibilityRole="radiogroup">
      {UI_COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          accessibilityRole="radio"
          accessibilityLabel={c}
          accessibilityState={{ selected: value === c }}
          style={styles.swatchHit}
        >
          <View style={[styles.swatch, { backgroundColor: labelColor(c) }, value === c && styles.swatchOn]} />
        </Pressable>
      ))}
    </View>
  );
}

/** Web ActivityPanel / CardModal activity rows: actor, text, time. */
export function ActivityList({ items, compact }: { items: ActivityDTO[]; compact?: boolean }) {
  if (items.length === 0) return <Text variant={compact ? "caption" : "small"}>No activity yet.</Text>;
  const variant = compact ? "caption" : "small";
  return (
    <View style={{ gap: compact ? 8 : 10 }}>
      {items.map((a) => (
        <View key={a.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Text variant={variant} style={{ flex: 1 }}>
            <Text variant={variant} weight="medium" color={colors.foreground}>{a.actor}</Text> {a.text}
          </Text>
          <Text variant="caption">{fmtTime(a.createdAt)}</Text>
        </View>
      ))}
    </View>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={40} />
      ))}
    </View>
  );
}

// ---- Members ---------------------------------------------------------------

export function MembersSheet({ board, visible, onClose }: { board: BoardDTO; visible: boolean; onClose: () => void }) {
  const { run, busy } = useBoardAction();
  const sheet = useActionSheet();
  const boardPath = `/api/boards/${board.id}`;
  const myRank = ROLE_RANK[board.role];
  const grantable = ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < myRank);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [role, setRole] = useState<BoardRole>("member");

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = useApiQuery<MemberSearchResponse>(`${boardPath}/members`, { q: term }, { enabled: visible && board.can.manageMembers && term.length >= 2 });

  async function add(email: string) {
    const res = await run(`${boardPath}/members`, { body: { email, role }, invalidates: [boardPath], success: "Member added", alertErrors: true });
    if (res) {
      setQ("");
      setTerm("");
    }
  }

  function pickRole(m: BoardDTO["members"][number]) {
    sheet.show({
      title: m.name,
      options: grantable.map((r) => ({
        label: r,
        selected: m.role === r,
        onPress: () => {
          if (m.role !== r) void run(`${boardPath}/members/${m.userId}`, { method: "PATCH", body: { role: r }, invalidates: [boardPath], success: "Role updated", alertErrors: true });
        },
      })),
    });
  }

  function remove(m: BoardDTO["members"][number]) {
    Alert.alert("Remove member?", `${m.name} will lose access to this board.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void run(`${boardPath}/members/${m.userId}`, { method: "DELETE", invalidates: [boardPath], success: "Member removed", alertErrors: true }),
      },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Board members">
      {board.can.manageMembers && grantable.length > 0 ? (
        <Card style={{ gap: 8, padding: 12 }}>
          <Text variant="caption">Add a member by email or stage name</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                value={q}
                onChangeText={setQ}
                placeholder="Search users…"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search users"
              />
            </View>
            <SelectField
              value={role}
              onPress={() =>
                sheet.show({ title: "Role for new member", options: grantable.map((r) => ({ label: r, selected: role === r, onPress: () => setRole(r) })) })
              }
              accessibilityLabel="Role"
              style={{ minWidth: 110 }}
            />
          </View>
          {term.length >= 2 ? (
            search.isLoading ? (
              <Skeleton height={40} />
            ) : (search.data?.users.length ?? 0) === 0 ? (
              <Text variant="caption" style={{ paddingHorizontal: 8 }}>{search.isError ? "Search failed. Try again." : "No matching users"}</Text>
            ) : (
              search.data!.users.map((u) => (
                <Pressable
                  key={u.userId}
                  disabled={busy}
                  onPress={() => void add(u.email)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${u.name} as ${role}`}
                  style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surface2 }]}
                >
                  <Text style={{ flex: 1 }} numberOfLines={1}>{u.name}</Text>
                  <Text variant="caption" numberOfLines={1} style={{ maxWidth: "55%" }}>{u.email}</Text>
                </Pressable>
              ))
            )
          ) : null}
        </Card>
      ) : null}

      <View>
        {board.members.map((m) => {
          const isOwner = m.userId === board.ownerId || m.role === "owner";
          const canManage = board.can.manageMembers && !isOwner && ROLE_RANK[m.role] < myRank;
          return (
            <View key={m.userId} style={styles.row}>
              <Initials name={m.name} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1}>{m.name}</Text>
                {m.email ? <Text variant="caption" numberOfLines={1}>{m.email}</Text> : null}
              </View>
              {canManage ? (
                <>
                  <SelectField value={m.role} onPress={() => pickRole(m)} accessibilityLabel={`${m.name}'s role`} style={{ minWidth: 96 }} />
                  <Pressable onPress={() => remove(m)} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} hitSlop={6} style={styles.textBtn}>
                    <Text variant="caption">Remove</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.pill}>
                  <Text variant="caption">{m.role}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
      {sheet.element}
    </Sheet>
  );
}

// ---- Labels ----------------------------------------------------------------

export function LabelsSheet({ board, visible, onClose }: { board: BoardDTO; visible: boolean; onClose: () => void }) {
  const { run, busy } = useBoardAction();
  const boardPath = `/api/boards/${board.id}`;
  const canManage = board.can.manageLabels;
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("brand");
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);

  async function create() {
    const res = await run(`${boardPath}/labels`, { body: { name: name.trim(), color }, invalidates: [boardPath], success: "Label created", alertErrors: true });
    if (res) setName("");
  }
  async function save() {
    if (!editing) return;
    const res = await run(`/api/labels/${editing.id}`, {
      method: "PATCH",
      body: { name: editing.name.trim(), color: editing.color },
      invalidates: [boardPath],
      success: "Label updated",
      alertErrors: true,
    });
    if (res) setEditing(null);
  }
  function remove(id: string, label: string) {
    Alert.alert("Delete label?", `“${label}” will be removed from every card on this board.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await run(`/api/labels/${id}`, { method: "DELETE", invalidates: [boardPath, "/api/cards"], success: "Label deleted", alertErrors: true });
          if (res) setEditing(null);
        },
      },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Labels">
      {canManage ? (
        <Card style={{ gap: 12 }}>
          <Text variant="label">New label</Text>
          <Field value={name} onChangeText={setName} placeholder="Label name" maxLength={40} accessibilityLabel="Label name" />
          <ColorSwatches value={color} onChange={setColor} />
          <Button title="Add label" size="sm" icon="plus" onPress={() => void create()} loading={busy} />
        </Card>
      ) : null}
      {board.labels.length === 0 ? (
        <EmptyState title="No labels yet" icon="flag" body={canManage ? "Create labels to tag and filter cards." : undefined} />
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          {board.labels.map((l, i) => (
            <View key={l.id}>
              {i > 0 ? <Divider /> : null}
              {editing?.id === l.id ? (
                <View style={{ padding: 16, gap: 12 }}>
                  <Field
                    value={editing.name}
                    onChangeText={(t) => setEditing({ ...editing, name: t })}
                    maxLength={40}
                    autoFocus
                    accessibilityLabel="Label name"
                  />
                  <ColorSwatches value={editing.color} onChange={(c) => setEditing({ ...editing, color: c })} />
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Button title="Save" size="sm" onPress={() => void save()} loading={busy} />
                    <Button title="Cancel" size="sm" variant="ghost" onPress={() => setEditing(null)} />
                    <Button title="Delete" size="sm" variant="danger" onPress={() => remove(l.id, l.name || l.color)} style={{ marginLeft: "auto" }} />
                  </View>
                </View>
              ) : (
                <Pressable
                  disabled={!canManage}
                  onPress={() => setEditing({ id: l.id, name: l.name, color: l.color })}
                  accessibilityRole={canManage ? "button" : undefined}
                  accessibilityHint={canManage ? "Edit label" : undefined}
                  style={({ pressed }) => [styles.row, { paddingHorizontal: 16 }, pressed && { backgroundColor: colors.surface2 }]}
                >
                  <View style={[styles.swatch, { backgroundColor: labelColor(l.color) }]} />
                  <Text style={{ flex: 1 }} numberOfLines={1}>{l.name || l.color}</Text>
                  {canManage ? <Icon name="pencil" size={16} color={colors.muted} /> : null}
                </Pressable>
              )}
            </View>
          ))}
        </Card>
      )}
    </Sheet>
  );
}

// ---- Activity --------------------------------------------------------------

export function ActivitySheet({ boardId, visible, onClose }: { boardId: string; visible: boolean; onClose: () => void }) {
  const query = useApiQuery<ActivityResponse>(`/api/boards/${boardId}/activity`, undefined, { enabled: visible });
  return (
    <Sheet visible={visible} onClose={onClose} title="Board activity">
      <QueryView query={query} skeleton={<ListSkeleton />}>
        {(d) => <ActivityList items={d.activity} />}
      </QueryView>
    </Sheet>
  );
}

// ---- Archived cards --------------------------------------------------------

export function ArchiveSheet({ board, visible, onClose }: { board: BoardDTO; visible: boolean; onClose: () => void }) {
  const { run } = useBoardAction();
  const boardPath = `/api/boards/${board.id}`;
  const query = useApiQuery<ArchiveResponse>(`${boardPath}/archive`, undefined, { enabled: visible });
  const [restoring, setRestoring] = useState<string | null>(null);

  async function restore(id: string) {
    setRestoring(id);
    await run(`/api/cards/${id}`, { method: "PATCH", body: { archived: false }, invalidates: [boardPath, `/api/cards/${id}`, "/api/boards", MY_TASKS_PATH], success: "Card restored", alertErrors: true });
    setRestoring(null);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Archived cards">
      <QueryView
        query={query}
        skeleton={<ListSkeleton />}
        isEmpty={(d) => d.cards.length === 0}
        empty={<Text variant="small">No archived cards.</Text>}
      >
        {(d) => (
          <View style={{ gap: 8 }}>
            {d.cards.map((c) => (
              <Card key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                <Pressable
                  style={{ flex: 1, minWidth: 0, minHeight: TOUCH, justifyContent: "center" }}
                  accessibilityRole="button"
                  accessibilityHint="Open card"
                  onPress={() => {
                    onClose();
                    setTimeout(() => router.push(`/boards/card/${c.id}` as Href), 350);
                  }}
                >
                  <Text numberOfLines={2}>{c.title}</Text>
                  <Text variant="caption">was in {c.columnTitle}</Text>
                </Pressable>
                {board.can.editCards ? (
                  <Button title="Restore" size="sm" variant="ghost" loading={restoring === c.id} onPress={() => void restore(c.id)} />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </QueryView>
    </Sheet>
  );
}

// ---- Board settings --------------------------------------------------------

export function SettingsSheet({ board, visible, onClose }: { board: BoardDTO; visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Board settings">
      {/* Mounted only while open, so the form starts from the latest server values. */}
      {visible ? <SettingsForm board={board} onClose={onClose} /> : null}
    </Sheet>
  );
}

function SettingsForm({ board, onClose }: { board: BoardDTO; onClose: () => void }) {
  const { run, busy } = useBoardAction();
  const invalidate = useInvalidate();
  const toast = useToast();
  const boardPath = `/api/boards/${board.id}`;
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description);
  const [color, setColor] = useState(board.color);

  async function save() {
    if (!title.trim()) {
      Alert.alert("Board name required", "Give the board a name.");
      return;
    }
    const res = await run(boardPath, {
      method: "PATCH",
      body: { title: title.trim(), description, color: (UI_COLORS as readonly string[]).includes(color) ? color : undefined },
      invalidates: [boardPath, "/api/boards"],
      success: "Board saved",
      alertErrors: true,
    });
    if (res) onClose();
  }

  function toggleArchive() {
    const next = !board.archived;
    Alert.alert(next ? "Archive board?" : "Restore board?", next ? "The board stays readable and can be restored later." : undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: next ? "Archive" : "Restore",
        onPress: () => void run(boardPath, { method: "PATCH", body: { archived: next }, invalidates: ["/api/boards"], success: next ? "Board archived" : "Board restored", alertErrors: true }),
      },
    ]);
  }

  function remove() {
    Alert.alert("Delete this board?", "Everything in it — columns, cards, comments and attachments — is deleted. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await run(boardPath, { method: "DELETE", alertErrors: true });
          if (!res) return;
          onClose();
          // Leave the deleted board first so its query isn't refetched into a 404.
          if (router.canGoBack()) router.back();
          else router.replace("/boards" as Href);
          toast("Board deleted");
          setTimeout(() => void invalidate("/api/boards"), 400);
        },
      },
    ]);
  }

  return (
    <>
      {board.can.manageBoard ? (
        <Card style={{ gap: 14 }}>
          <Field label="Name" value={title} onChangeText={setTitle} maxLength={120} />
          <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline placeholder="What is this board for?" />
          <View style={{ gap: 6 }}>
            <Text variant="caption" weight="medium" color={colors.foreground}>Colour</Text>
            <ColorSwatches value={color} onChange={setColor} />
          </View>
          <Button title="Save changes" onPress={() => void save()} loading={busy} fullWidth />
        </Card>
      ) : null}
      {board.can.manageBoard ? (
        <Button title={board.archived ? "Restore board" : "Archive board"} variant="ghost" icon="inbox" onPress={toggleArchive} fullWidth />
      ) : null}
      {board.can.deleteBoard ? <Button title="Delete board" variant="danger" onPress={remove} fullWidth /> : null}
      {!board.can.manageBoard && !board.can.deleteBoard ? <Text variant="small">Only board admins can change these settings.</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, paddingVertical: 8, paddingHorizontal: 8 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH, paddingHorizontal: 8, borderRadius: radius.sm },
  textBtn: { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  swatchHit: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  swatch: { width: 24, height: 24, borderRadius: radius.pill },
  swatchOn: { borderWidth: 3, borderColor: colors.foreground },
});
