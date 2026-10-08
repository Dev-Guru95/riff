// Card detail — the web's CardModal as a full screen: title, column + move,
// watch, priority, due date, completion, labels, assignees, description
// (Markdown view/edit), checklists, attachments, comments and activity, plus
// duplicate / archive / delete.
//
// Data: GET /api/cards/[id] → { card, can }; the board's labels, members and
// columns come from GET /api/boards/[boardId] (usually already cached by the
// board screen). Every write invalidates both so the board stays in sync.

import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { LabelsSheet } from "@/components/boards/BoardPanels";
import { AttachmentsSection, CardActivitySection, ChecklistsSection, CommentsSection, SectionTitle } from "@/components/boards/CardSections";
import { DueDateField } from "@/components/boards/DueDateField";
import { MoveCardSheet } from "@/components/boards/MoveCardSheet";
import { useActionSheet, type SheetOption } from "@/components/boards/Sheet";
import { useBoardAction } from "@/components/boards/useBoardAction";
import { labelColor, PRIORITY } from "@/components/boards/utils";
import { Markdown } from "@/components/Markdown";
import { Button, Card, Chip, Divider, Field, Icon, Pill, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { CARD_PRIORITIES } from "@/lib/constants";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { BoardCapabilities, BoardDTO, BoardResponse, CardDetailDTO, CardResponse } from "@/types/boards";

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardPath = `/api/cards/${id}`;
  const query = useApiQuery<CardResponse>(cardPath);
  const boardId = query.data?.card.boardId;
  const boardQuery = useApiQuery<BoardResponse>(boardId ? `/api/boards/${boardId}` : null);

  return (
    <Screen
      onRefresh={() => Promise.all([query.refetch(), boardQuery.refetch()])}
      contentStyle={{ gap: 20 }}
    >
      <Stack.Screen options={{ title: boardQuery.data?.board.title ?? "Card" }} />
      <QueryView query={query}>
        {(d) => <CardBody key={d.card.id} card={d.card} can={d.can} board={boardQuery.data?.board ?? null} />}
      </QueryView>
    </Screen>
  );
}

function CardBody({ card, can, board }: { card: CardDetailDTO; can: BoardCapabilities; board: BoardDTO | null }) {
  const { user } = useAuth();
  const me = user?.user.id;
  const { run } = useBoardAction();
  const invalidate = useInvalidate();
  const sheet = useActionSheet();
  const cardPath = `/api/cards/${card.id}`;
  const boardPath = `/api/boards/${card.boardId}`;
  const inv = [cardPath, boardPath];
  const editable = can.editCards;

  const [title, setTitle] = useState(card.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState(card.description);
  const [savingDesc, setSavingDesc] = useState(false);
  const [moving, setMoving] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const patch = (body: Record<string, unknown>, success?: string) => run(cardPath, { method: "PATCH", body, invalidates: inv, success });

  function setPriority(p: string | null) {
    if (editable && card.priority !== p) void patch({ priority: p });
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
    setSavingDesc(true);
    const res = await patch({ description }, "Description saved");
    setSavingDesc(false);
    if (res) setEditingDesc(false);
  }

  const column = board?.columns.find((c) => c.id === card.columnId);
  const labels = board?.labels ?? [];
  const members = board?.members ?? [];
  const attached = new Set(card.labelIds);
  const assigned = new Set(card.assignees.map((a) => a.userId));

  function toggleLabel(labelId: string) {
    if (attached.has(labelId)) void run(`${cardPath}/labels/${labelId}`, { method: "DELETE", invalidates: inv });
    else void run(`${cardPath}/labels`, { body: { labelId }, invalidates: inv });
  }
  function toggleAssignee(userId: string) {
    if (assigned.has(userId)) void run(`${cardPath}/assignees/${userId}`, { method: "DELETE", invalidates: inv });
    else void run(`${cardPath}/assignees`, { body: { userId }, invalidates: inv });
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace(`/boards/${card.boardId}` as Href);
  }

  function menu() {
    const options: SheetOption[] = [];
    if (editable) {
      options.push(
        { label: "Move to…", icon: "route", disabled: !board, onPress: () => setMoving(true) },
        {
          label: "Duplicate",
          icon: "layers",
          onPress: async () => {
            const res = await run<{ id: string }>(`${cardPath}/duplicate`, { invalidates: [boardPath], success: "Card duplicated" });
            if (res?.id) router.replace(`/boards/card/${res.id}` as Href);
          },
        },
        card.archived
          ? { label: "Restore from archive", icon: "inbox", onPress: () => void patch({ archived: false }, "Card restored") }
          : {
              label: "Archive",
              icon: "inbox",
              onPress: async () => {
                if (await patch({ archived: true }, "Card archived")) leave();
              },
            },
      );
    }
    if (can.manageColumns) {
      options.push({
        label: "Delete permanently",
        icon: "close",
        destructive: true,
        onPress: () =>
          Alert.alert("Delete this card?", "The card, its checklists, comments and attachments are deleted. This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                const res = await run(cardPath, { method: "DELETE", success: "Card deleted" });
                if (res) {
                  leave();
                  setTimeout(() => void invalidate(boardPath), 300);
                }
              },
            },
          ]),
      });
    }
    sheet.show({ title: card.title, options });
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight:
            editable || can.manageColumns
              ? () => (
                  <Pressable onPress={menu} accessibilityRole="button" accessibilityLabel="Card actions" hitSlop={6} style={styles.headerBtn}>
                    <Icon name="more" size={20} />
                  </Pressable>
                )
              : undefined,
        }}
      />

      <View style={{ gap: 10 }}>
        {card.archived ? <Chip label="Archived" tone="warning" icon="inbox" /> : null}
        {editable ? (
          <Field
            value={title}
            onChangeText={setTitle}
            onBlur={saveTitle}
            onSubmitEditing={saveTitle}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            maxLength={300}
            multiline
            accessibilityLabel="Card title"
            style={styles.titleInput}
          />
        ) : (
          <Text variant="title">{card.title}</Text>
        )}
        <View style={styles.wrapRow}>
          {editable && board ? (
            <Pressable onPress={() => setMoving(true)} accessibilityRole="button" accessibilityLabel={`In column ${column?.title ?? ""}. Move card`} style={styles.columnBtn}>
              <Icon name="kanban" size={14} color={colors.muted} />
              <Text variant="small" color={colors.foreground}>{column?.title ?? "Column"}</Text>
              <Icon name="chevronDown" size={14} color={colors.muted} />
            </Pressable>
          ) : column ? (
            <Chip label={column.title} icon="kanban" />
          ) : null}
          <Pressable
            onPress={() =>
              void run(`${cardPath}/watch`, { method: card.watching ? "DELETE" : "POST", invalidates: [cardPath], success: card.watching ? "Stopped watching" : "Watching this card" })
            }
            accessibilityRole="button"
            accessibilityState={{ selected: card.watching }}
            accessibilityLabel={card.watching ? "Watching. Tap to stop" : "Watch this card"}
            style={[styles.columnBtn, card.watching && { borderColor: colors.brand, backgroundColor: colors.surface2 }]}
          >
            <Icon name="bell" size={14} color={card.watching ? colors.brand : colors.muted} />
            <Text variant="small" color={colors.foreground}>
              {card.watching ? "Watching" : "Watch"}
              {card.watchersCount > 0 ? ` · ${card.watchersCount}` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      <Card style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <SectionTitle title="Priority" />
          <View style={styles.wrapRow}>
            <Pill label="None" active={!card.priority} onPress={() => setPriority(null)} />
            {CARD_PRIORITIES.map((p) => (
              <Pill key={p} label={PRIORITY[p]!.label} active={card.priority === p} onPress={() => setPriority(p)} />
            ))}
          </View>
        </View>
        <Divider />
        <View style={{ gap: 8 }}>
          <SectionTitle title="Due date" />
          <DueDateField value={card.dueDate} editable={editable} onChange={(iso) => void patch({ dueDate: iso })} />
        </View>
        <Divider />
        <View style={{ gap: 8 }}>
          <SectionTitle title={`Completion — ${card.completion}%`} />
          <ProgressBar pct={card.completion} height={6} />
          {editable ? (
            <View style={styles.wrapRow}>
              {[0, 25, 50, 75, 100].map((v) => (
                <Pill
                  key={v}
                  label={`${v}%`}
                  active={card.completion === v}
                  onPress={() => {
                    if (card.completion !== v) void patch({ completion: v });
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle
          title="Labels"
          right={can.manageLabels && board ? <Button title="Manage" size="sm" variant="link" onPress={() => setLabelsOpen(true)} /> : undefined}
        />
        <View style={styles.wrapRow}>
          {labels.length === 0 ? <Text variant="small">{board ? "This board has no labels." : "Loading labels…"}</Text> : null}
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
                style={[styles.toggleChip, on ? { backgroundColor: labelColor(l.color), borderColor: labelColor(l.color) } : null]}
              >
                <Text variant="small" color={on ? colors.white : colors.muted} weight="medium">{l.name || l.color}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Assignees" />
        <View style={styles.wrapRow}>
          {members.length === 0 ? (
            card.assignees.map((a) => <Chip key={a.userId} label={a.name} icon="user" />)
          ) : (
            members.map((m) => {
              const on = assigned.has(m.userId);
              const canToggle = editable && (can.assignOthers || m.userId === me);
              return (
                <Pressable
                  key={m.userId}
                  disabled={!canToggle}
                  hitSlop={4}
                  onPress={() => toggleAssignee(m.userId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !canToggle }}
                  style={[styles.toggleChip, on && { borderColor: colors.brand, backgroundColor: colors.surface2 }, !canToggle && { opacity: 0.5 }]}
                >
                  {on ? <Icon name="check" size={13} color={colors.brand} /> : null}
                  <Text variant="small" color={on ? colors.foreground : colors.muted} weight="medium">{m.name}</Text>
                </Pressable>
              );
            })
          )}
          {members.length === 0 && card.assignees.length === 0 ? <Text variant="small">Nobody assigned.</Text> : null}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle
          title="Description"
          right={editable && !editingDesc ? <Button title={card.description ? "Edit" : "Add"} size="sm" variant="link" onPress={() => setEditingDesc(true)} /> : undefined}
        />
        {editingDesc ? (
          <View style={{ gap: 8 }}>
            <Field
              value={description}
              onChangeText={setDescription}
              multiline
              autoFocus
              maxLength={20000}
              placeholder="Add more detail… Markdown supported: **bold**, *italic*, - lists, `code`, [links](https://…)"
              accessibilityLabel="Description"
              style={{ minHeight: 160 }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Save" size="sm" onPress={() => void saveDescription()} loading={savingDesc} />
              <Button
                title="Cancel"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setDescription(card.description);
                  setEditingDesc(false);
                }}
              />
            </View>
          </View>
        ) : card.description.trim() ? (
          <Card>
            <Markdown>{card.description}</Markdown>
          </Card>
        ) : (
          <Text variant="small">No description.</Text>
        )}
      </View>

      <ChecklistsSection card={card} editable={editable} invalidates={inv} />
      <AttachmentsSection card={card} editable={editable} invalidates={inv} />
      <CommentsSection cardId={card.id} can={can} members={members} currentUserId={me} invalidates={inv} />
      <CardActivitySection cardId={card.id} />

      {board ? (
        <>
          <MoveCardSheet
            visible={moving}
            card={{ id: card.id, title: card.title, columnId: card.columnId }}
            columns={board.columns}
            onClose={() => setMoving(false)}
            onMove={(toColumnId, toIndex) =>
              void run(`${cardPath}/move`, { body: { toColumnId, toIndex }, invalidates: inv, success: "Card moved" })
            }
          />
          <LabelsSheet board={board} visible={labelsOpen} onClose={() => setLabelsOpen(false)} />
        </>
      ) : null}
      {sheet.element}
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  titleInput: { fontSize: 20, lineHeight: 26, fontFamily: fonts.semibold, minHeight: TOUCH },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  columnBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
