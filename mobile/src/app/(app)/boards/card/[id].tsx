// Card detail — the web's CardModal ("Card details") as a full screen, in the
// same order: 👁 Watch, title, Move to, Labels (+ label), Assignees, Priority +
// Due date, Description (Markdown editor), Completion slider, Checklists,
// Attachments, Duplicate / Archive / Delete, Comments and Activity.
//
// Data: GET /api/cards/[id] → { card, can }; the board's labels, members and
// columns come from GET /api/boards/[boardId] (usually already cached by the
// board screen). Every write invalidates the card, the board, the boards list
// and the projects dashboard so they stay in sync.

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { Slider } from "@expo/ui/community/slider";

import { useAuth } from "@/auth/AuthProvider";
import { Caption, SelectField } from "@/components/boards/bits";
import { AttachmentsSection, CardActivitySection, ChecklistsSection, CommentsSection } from "@/components/boards/CardSections";
import { ColorSwatches } from "@/components/boards/BoardPanels";
import { DueDateField } from "@/components/boards/DueDateField";
import { MarkdownEditor } from "@/components/boards/MarkdownEditor";
import { MoveCardSheet } from "@/components/boards/MoveCardSheet";
import { MY_TASKS_PATH } from "@/components/boards/MyTasks";
import { useActionSheet } from "@/components/boards/Sheet";
import { useBoardAction } from "@/components/boards/useBoardAction";
import { labelColor, PRIORITY, PRIORITY_OPTIONS } from "@/components/boards/utils";
import { Button, Chip, Divider, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, fonts, radius, tint } from "@/theme/tokens";
import type { BoardCapabilities, BoardDTO, BoardResponse, CardDetailDTO, CardResponse } from "@/types/boards";

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardPath = `/api/cards/${id}`;
  const query = useApiQuery<CardResponse>(cardPath);
  const boardId = query.data?.card.boardId;
  const boardQuery = useApiQuery<BoardResponse>(boardId ? `/api/boards/${boardId}` : null);

  return (
    <Screen onRefresh={() => Promise.all([query.refetch(), boardQuery.refetch()])} contentStyle={{ gap: 16 }}>
      <Stack.Screen options={{ title: "Card details" }} />
      <QueryView query={query}>
        {(d) => <CardBody key={d.card.id} card={d.card} can={d.can} board={boardQuery.data?.board ?? null} />}
      </QueryView>
    </Screen>
  );
}

function CardBody({ card, can, board }: { card: CardDetailDTO; can: BoardCapabilities; board: BoardDTO | null }) {
  const { user } = useAuth();
  const me = user?.user.id;
  const { run, busy } = useBoardAction();
  const invalidate = useInvalidate();
  const sheet = useActionSheet();
  const cardPath = `/api/cards/${card.id}`;
  const boardPath = `/api/boards/${card.boardId}`;
  // "/api/boards" is a prefix of boardPath, so this also refreshes the board.
  const inv = [cardPath, "/api/boards", MY_TASKS_PATH];
  const editable = can.editCards;

  // Scalar edit state, initialised once like the web modal.
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [savingDesc, setSavingDesc] = useState(false);
  const [completion, setCompletion] = useState(card.completion);
  const [moving, setMoving] = useState(false);
  const [newLabel, setNewLabel] = useState<{ name: string; color: string } | null>(null);

  const patch = (body: Record<string, unknown>, success?: string) => run(cardPath, { method: "PATCH", body, invalidates: inv, success });

  // Completion slider: save once the thumb settles (the web saves on mouse-up).
  const pendingCompletion = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchRef = useRef(patch);
  useEffect(() => {
    patchRef.current = patch;
  });
  useEffect(
    () => () => {
      // Leaving the screen mid-drag still saves the last value.
      if (timer.current) clearTimeout(timer.current);
      if (pendingCompletion.current !== null) void patchRef.current({ completion: pendingCompletion.current });
    },
    [],
  );
  function onSlide(v: number) {
    const value = Math.max(0, Math.min(100, Math.round(v / 5) * 5));
    setCompletion(value);
    pendingCompletion.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const next = pendingCompletion.current;
      pendingCompletion.current = null;
      if (next !== null && next !== card.completion) void patch({ completion: next });
    }, 600);
  }

  function saveTitle() {
    const t = title.trim();
    if (!t) {
      setTitle(card.title);
      return;
    }
    if (t !== card.title) void patch({ title: t });
  }

  async function saveDescription() {
    if (savingDesc) return;
    setSavingDesc(true);
    await patch({ description }, "Description saved");
    setSavingDesc(false);
  }

  function pickPriority() {
    sheet.show({
      title: "Priority",
      options: [
        { label: "None", selected: !card.priority, onPress: () => card.priority !== null && void patch({ priority: null }) },
        ...PRIORITY_OPTIONS.map((p) => ({
          label: PRIORITY[p]!.label,
          selected: card.priority === p,
          onPress: () => card.priority !== p && void patch({ priority: p }),
        })),
      ],
    });
  }

  const labels = board?.labels ?? [];
  const members = board?.members ?? [];
  const columns = board?.columns ?? [];
  const attached = new Set(card.labelIds);
  const assigned = new Set(card.assignees.map((a) => a.userId));

  function toggleLabel(labelId: string) {
    if (attached.has(labelId)) void run(`${cardPath}/labels/${labelId}`, { method: "DELETE", invalidates: inv });
    else void run(`${cardPath}/labels`, { body: { labelId }, invalidates: inv });
  }
  async function createLabel() {
    if (!newLabel || busy) return;
    const created = await run<{ id: string }>(`${boardPath}/labels`, { body: { name: newLabel.name.trim(), color: newLabel.color } });
    if (!created?.id) return;
    setNewLabel(null);
    await run(`${cardPath}/labels`, { body: { labelId: created.id }, invalidates: inv });
  }
  function toggleAssignee(userId: string) {
    if (assigned.has(userId)) void run(`${cardPath}/assignees/${userId}`, { method: "DELETE", invalidates: inv });
    else void run(`${cardPath}/assignees`, { body: { userId }, invalidates: inv });
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace(`/boards/${card.boardId}` as Href);
  }

  async function duplicate() {
    if (await run(`${cardPath}/duplicate`, { invalidates: inv, success: "Card duplicated" })) leave();
  }
  async function archive() {
    if (await patch({ archived: true }, "Card archived")) leave();
  }
  function del() {
    Alert.alert("Permanently delete this card?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await run(cardPath, { method: "DELETE", success: "Card deleted" });
          if (res) {
            leave();
            setTimeout(() => void invalidate("/api/boards", MY_TASKS_PATH), 300);
          }
        },
      },
    ]);
  }

  return (
    <>
      {/* Header row: archived state + watch toggle (web: 👁 Watch · N). */}
      <View style={styles.headRow}>
        {card.archived ? <Chip label="Archived" tone="warning" icon="inbox" /> : <View />}
        <Pressable
          onPress={() => void run(`${cardPath}/watch`, { method: card.watching ? "DELETE" : "POST", invalidates: [cardPath] })}
          accessibilityRole="button"
          accessibilityState={{ selected: card.watching }}
          accessibilityLabel={card.watching ? "You're following this card. Tap to stop watching" : "Follow this card"}
          style={[styles.watch, card.watching && styles.watchOn]}
        >
          <Text variant="caption" color={card.watching ? colors.foreground : colors.muted}>
            {card.watching ? "👁 Watching" : "👁 Watch"}
            {card.watchersCount > 0 ? ` · ${card.watchersCount}` : ""}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        onSubmitEditing={saveTitle}
        editable={editable}
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        multiline
        maxLength={300}
        selectionColor={colors.brand}
        accessibilityLabel="Card title"
        style={[styles.titleInput, !editable && { opacity: 0.7 }]}
      />

      {editable && columns.length > 1 ? (
        <View style={styles.moveRow}>
          <Text variant="caption">Move to</Text>
          <SelectField value="choose column…" onPress={() => setMoving(true)} accessibilityLabel="Move to" style={{ flex: 1 }} />
        </View>
      ) : null}

      {/* Labels */}
      <View>
        <Caption>Labels</Caption>
        <View style={styles.wrapRow}>
          {labels.map((l) => {
            const on = attached.has(l.id);
            return (
              <Pressable
                key={l.id}
                disabled={!editable}
                hitSlop={4}
                onPress={() => toggleLabel(l.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !editable }}
                style={[styles.chip, on ? { backgroundColor: labelColor(l.color), borderColor: "transparent" } : null]}
              >
                <Text variant="caption" color={on ? colors.white : colors.muted}>{l.name || l.color}</Text>
              </Pressable>
            );
          })}
          {can.manageLabels && board && !newLabel ? (
            <Pressable onPress={() => setNewLabel({ name: "", color: "brand" })} accessibilityRole="button" accessibilityLabel="New label" style={[styles.chip, styles.dashed]}>
              <Text variant="caption">+ label</Text>
            </Pressable>
          ) : null}
        </View>
        {newLabel ? (
          <View style={styles.newLabel}>
            <TextInput
              value={newLabel.name}
              onChangeText={(t) => setNewLabel({ ...newLabel, name: t })}
              autoFocus
              maxLength={40}
              placeholder="Label name"
              placeholderTextColor={colors.muted}
              selectionColor={colors.brand}
              accessibilityLabel="Label name"
              style={styles.smallInput}
            />
            <ColorSwatches value={newLabel.color} onChange={(c) => setNewLabel({ ...newLabel, color: c })} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Add" size="sm" onPress={() => void createLabel()} loading={busy} />
              <Button title="Cancel" size="sm" variant="ghost" onPress={() => setNewLabel(null)} />
            </View>
          </View>
        ) : null}
      </View>

      {/* Assignees */}
      <View>
        <Caption>Assignees</Caption>
        <View style={styles.wrapRow}>
          {members.length === 0
            ? card.assignees.map((a) => <Chip key={a.userId} label={a.name} icon="user" />)
            : members.map((m) => {
                const on = assigned.has(m.userId);
                // Server rule: self-assign needs editCards, others need assignOthers.
                const canToggle = m.userId === me ? editable : can.assignOthers;
                return (
                  <Pressable
                    key={m.userId}
                    disabled={!canToggle}
                    hitSlop={4}
                    onPress={() => toggleAssignee(m.userId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !canToggle }}
                    style={[styles.chip, on && styles.chipOn, !canToggle && { opacity: 0.4 }]}
                  >
                    <Text variant="caption" color={on ? colors.foreground : colors.muted}>
                      {on ? "✓ " : ""}
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
        </View>
      </View>

      {/* Priority + due */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Caption>Priority</Caption>
          <SelectField
            value={card.priority ? (PRIORITY[card.priority]?.label ?? card.priority) : "None"}
            onPress={pickPriority}
            disabled={!editable}
            accessibilityLabel="Priority"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Caption>Due date</Caption>
          <DueDateField value={card.dueDate} editable={editable} onChange={(iso) => void patch({ dueDate: iso })} />
        </View>
      </View>

      {/* Description */}
      <View>
        <Caption>Description</Caption>
        <MarkdownEditor value={description} onChange={setDescription} disabled={!editable} maxLength={20000} placeholder="Add more detail…" accessibilityLabel="Description" />
        {editable ? (
          <Button
            title={savingDesc ? "Saving…" : "Save description"}
            size="sm"
            variant="ghost"
            onPress={() => void saveDescription()}
            loading={savingDesc}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </View>

      {/* Completion */}
      <View>
        <Caption>{`Completion — ${completion}%`}</Caption>
        <Slider
          value={completion}
          minimumValue={0}
          maximumValue={100}
          step={5}
          disabled={!editable}
          minimumTrackTintColor={colors.brand}
          maximumTrackTintColor={colors.surface2}
          thumbTintColor={colors.brand}
          onValueChange={onSlide}
          style={{ width: "100%", minHeight: 40 }}
        />
      </View>

      <ChecklistsSection card={card} editable={editable} invalidates={inv} />
      <AttachmentsSection card={card} editable={editable} invalidates={inv} />

      {editable ? (
        <>
          <Divider />
          <View style={styles.actions}>
            <Button title="Duplicate" size="sm" variant="ghost" onPress={() => void duplicate()} />
            {card.archived ? (
              <Button title="Restore" size="sm" variant="ghost" onPress={() => void patch({ archived: false }, "Card restored")} />
            ) : (
              <Button title="Archive" size="sm" variant="ghost" onPress={() => void archive()} />
            )}
            {can.manageColumns ? <Button title="Delete" size="sm" variant="danger" onPress={del} style={{ marginLeft: "auto" }} /> : null}
          </View>
        </>
      ) : null}

      <Divider />
      <CommentsSection cardId={card.id} can={can} members={members} currentUserId={me} invalidates={inv} />
      <CardActivitySection cardId={card.id} />

      {board ? (
        <MoveCardSheet
          visible={moving}
          card={{ id: card.id, title: card.title, columnId: card.columnId }}
          columns={board.columns}
          onClose={() => setMoving(false)}
          onMove={(toColumnId, toIndex) =>
            void run(`${cardPath}/move`, { body: { toColumnId, toIndex }, invalidates: inv, success: "Card moved" }).then((ok) => {
              if (ok) leave();
            })
          }
        />
      ) : null}
      {sheet.element}
    </>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  watch: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchOn: { borderColor: colors.brand, backgroundColor: tint(colors.brand, 0.2) },
  titleInput: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: fonts.semibold,
    color: colors.foreground,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: {
    minHeight: 32,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.brand, backgroundColor: tint(colors.brand, 0.2) },
  dashed: { borderStyle: "dashed" },
  newLabel: {
    marginTop: 8,
    padding: 8,
    gap: 8,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  smallInput: {
    minHeight: 40,
    paddingHorizontal: 8,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
