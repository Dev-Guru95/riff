// A board — the web's /boards/[id] (BoardView) as a native Kanban: columns are
// horizontally paged (one ~88%-wide column per page, snap scrolling), each with
// its own vertical card list. Drag-and-drop becomes "Move to…" (long-press a
// card). Board drawers are native sheets. `?card=<id>` (search, notifications)
// opens that card on arrival.
//
// Data: GET /api/boards/[id] (first 50 cards per column) + GET
// /api/columns/[id]/cards?offset= for the rest. Writes go to the same routes the
// web uses; the server enforces BoardCapabilities, the UI hides what `can` denies.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { get } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { BoardColumn, type ColumnView } from "@/components/boards/BoardColumn";
import { ActivitySheet, ArchiveSheet, LabelsSheet, MembersSheet, SettingsSheet } from "@/components/boards/BoardPanels";
import { MoveCardSheet } from "@/components/boards/MoveCardSheet";
import { useActionSheet, usePrompt, type SheetOption } from "@/components/boards/Sheet";
import { useBoardAction } from "@/components/boards/useBoardAction";
import { PRIORITY, templateFor } from "@/components/boards/utils";
import { Button, Chip, Field, Icon, Pill, QueryView, ScreenSkeleton, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { CARD_PRIORITIES } from "@/lib/constants";
import { colors, TOUCH } from "@/theme/tokens";
import type { BoardCardDTO, BoardDTO, BoardResponse, ColumnCardsResponse } from "@/types/boards";

type Filter = { text: string; label: string; assignee: string; priority: string };
const NO_FILTER: Filter = { text: "", label: "", assignee: "", priority: "" };
type Panel = "members" | "labels" | "activity" | "archive" | "settings" | null;

function cardMatches(card: BoardCardDTO, f: Filter) {
  if (f.text) {
    const t = f.text.toLowerCase();
    if (!card.title.toLowerCase().includes(t) && !card.description.toLowerCase().includes(t)) return false;
  }
  if (f.label && !card.labels.some((l) => l.id === f.label)) return false;
  if (f.assignee && !card.assignees.some((a) => a.userId === f.assignee)) return false;
  if (f.priority && card.priority !== f.priority) return false;
  return true;
}

function HeaderButton({ icon, label, onPress, active }: { icon: "search" | "more"; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.headerBtn}>
      <Icon name={icon} size={20} color={active ? colors.brand : colors.foreground} />
    </Pressable>
  );
}

export default function BoardScreen() {
  const { id, card: cardParam } = useLocalSearchParams<{ id: string; card?: string }>();
  const path = `/api/boards/${id}`;
  const query = useApiQuery<BoardResponse>(path);

  // Deep link: /boards/[id]?card=<id> opens the card once, then drops the param.
  const openedParam = useRef<string | null>(null);
  useEffect(() => {
    if (!cardParam || openedParam.current === cardParam) return;
    openedParam.current = cardParam;
    router.setParams({ card: undefined });
    router.push(`/boards/card/${cardParam}` as Href);
  }, [cardParam]);

  const title = query.data?.board.title ?? "Board";

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <QueryView query={query} skeleton={<ScreenSkeleton rows={3} />}>
        {(d) => <Board board={d.board} stamp={query.dataUpdatedAt} refetch={query.refetch} />}
      </QueryView>
    </View>
  );
}

function Board({ board, stamp, refetch }: { board: BoardDTO; stamp: number; refetch: () => Promise<unknown> }) {
  const { width: screenW } = useWindowDimensions();
  const toast = useToast();
  const { run } = useBoardAction();
  const sheet = useActionSheet();
  const prompt = usePrompt();
  const path = `/api/boards/${board.id}`;
  const can = board.can;

  // Cards fetched beyond the first page, per column. Tied to the board fetch
  // they extend (`stamp`), so a refetch starts clean instead of mixing orders.
  const [extra, setExtra] = useState<{ stamp: number; map: Record<string, BoardCardDTO[]> }>({ stamp, map: {} });
  const extraMap = useMemo(() => (extra.stamp === stamp ? extra.map : {}), [extra, stamp]);
  const columns: ColumnView[] = useMemo(
    () =>
      board.columns.map((c) => {
        const seen = new Set(c.cards.map((x) => x.id));
        const more = (extraMap[c.id] ?? []).filter((x) => !seen.has(x.id));
        return { id: c.id, title: c.title, cardTotal: c.cardTotal, cards: [...c.cards, ...more] };
      }),
    [board.columns, extraMap],
  );
  // Mirrors `extra` synchronously so back-to-back page fetches use the right offset.
  const extraRef = useRef(extra);

  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const fetchMore = useCallback(
    async (columnId: string) => {
      const col = board.columns.find((c) => c.id === columnId);
      if (!col) return false;
      const cur = extraRef.current.stamp === stamp ? extraRef.current.map : {};
      const loaded = col.cards.length + (cur[columnId]?.length ?? 0);
      if (loaded >= col.cardTotal) return false;
      const res = await get<ColumnCardsResponse>(`/api/columns/${columnId}/cards`, { offset: loaded });
      if (!res.cards.length) return false;
      const latest = extraRef.current.stamp === stamp ? extraRef.current.map : {};
      const next = { stamp, map: { ...latest, [columnId]: [...(latest[columnId] ?? []), ...res.cards] } };
      extraRef.current = next;
      setExtra(next);
      return true;
    },
    [board.columns, stamp],
  );
  async function loadMore(columnId: string) {
    setLoadingMore(columnId);
    try {
      await fetchMore(columnId);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoadingMore(null);
    }
  }

  // ---- Filter ---------------------------------------------------------------
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const filterActive = !!(filter.text || filter.label || filter.assignee || filter.priority);

  // While filtering, load every remaining page so matches cover the whole board.
  useEffect(() => {
    if (!filterActive) return;
    let cancelled = false;
    void (async () => {
      for (const col of board.columns) {
        let guard = 0;
        try {
          while (!cancelled && guard++ < 40 && (await fetchMore(col.id))) {
            /* keep paging */
          }
        } catch {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterActive, fetchMore, board.columns]);

  // ---- Paging ---------------------------------------------------------------
  const colW = Math.round(screenW * 0.88);
  const GAP = 12;
  const listRef = useRef<FlatList<ColumnView | "add">>(null);
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(0);
  const pages: (ColumnView | "add")[] = can.manageColumns && !filterActive ? [...columns, "add"] : columns;
  const goTo = (i: number) => {
    setPage(i);
    listRef.current?.scrollToOffset({ offset: i * (colW + GAP), animated: true });
  };

  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  // ---- Panels & move --------------------------------------------------------
  const [panel, setPanel] = useState<Panel>(null);
  const [moving, setMoving] = useState<BoardCardDTO | null>(null);

  async function moveCard(card: BoardCardDTO, toColumnId: string, toIndex: number) {
    const res = await run(`/api/cards/${card.id}/move`, { body: { toColumnId, toIndex }, invalidates: [path, `/api/cards/${card.id}`], success: "Card moved" });
    if (res) {
      const idx = columns.findIndex((c) => c.id === toColumnId);
      if (idx >= 0 && toColumnId !== card.columnId) goTo(idx);
    }
  }

  async function addCard(columnId: string, title: string) {
    const res = await run(`/api/columns/${columnId}/cards`, { body: { title }, invalidates: [path] });
    return !!res;
  }

  function addColumn() {
    prompt.show({
      title: "Add column",
      placeholder: "Column name",
      confirmLabel: "Add",
      maxLength: 80,
      onSubmit: async (t) => {
        const res = await run(`${path}/columns`, { body: { title: t }, invalidates: [path], success: "Column added" });
        if (res) setTimeout(() => goTo(columns.length), 400);
      },
    });
  }

  function columnMenu(col: ColumnView, index: number) {
    const options: SheetOption[] = [
      {
        label: "Rename",
        icon: "pencil",
        onPress: () =>
          prompt.show({
            title: "Rename column",
            initial: col.title,
            maxLength: 80,
            onSubmit: (t) => {
              if (t !== col.title) void run(`/api/columns/${col.id}`, { method: "PATCH", body: { title: t }, invalidates: [path], success: "Column renamed" });
            },
          }),
      },
    ];
    if (index > 0)
      options.push({
        label: "Move column left",
        icon: "chevronLeft",
        onPress: async () => {
          if (await run(`/api/columns/${col.id}`, { method: "PATCH", body: { toIndex: index - 1 }, invalidates: [path] })) goTo(index - 1);
        },
      });
    if (index < columns.length - 1)
      options.push({
        label: "Move column right",
        icon: "chevronRight",
        onPress: async () => {
          if (await run(`/api/columns/${col.id}`, { method: "PATCH", body: { toIndex: index + 1 }, invalidates: [path] })) goTo(index + 1);
        },
      });
    options.push({
      label: "Delete column",
      icon: "close",
      destructive: true,
      onPress: () =>
        confirmDelete(`Delete “${col.title}”?`, `The column and its ${col.cardTotal} card${col.cardTotal === 1 ? "" : "s"} will be deleted.`, () =>
          void run(`/api/columns/${col.id}`, { method: "DELETE", invalidates: [path], success: "Column deleted" }).then((ok) => {
            if (ok && index > 0) goTo(index - 1);
          }),
        ),
    });
    sheet.show({ title: col.title, options });
  }

  function cardMenu(card: BoardCardDTO) {
    sheet.show({
      title: card.title,
      options: [
        { label: "Open card", icon: "card", onPress: () => router.push(`/boards/card/${card.id}` as Href) },
        ...(can.editCards
          ? [
              { label: "Move to…", icon: "route" as const, onPress: () => setMoving(card) },
              {
                label: "Duplicate",
                icon: "layers" as const,
                onPress: () => void run(`/api/cards/${card.id}/duplicate`, { invalidates: [path], success: "Card duplicated" }),
              },
              {
                label: "Archive",
                icon: "inbox" as const,
                onPress: () => void run(`/api/cards/${card.id}`, { method: "PATCH", body: { archived: true }, invalidates: [path], success: "Card archived" }),
              },
            ]
          : []),
      ],
    });
  }

  function boardMenu() {
    const options: SheetOption[] = [
      { label: "Members", icon: "community", onPress: () => setPanel("members") },
      { label: "Labels", icon: "flag", onPress: () => setPanel("labels") },
      { label: "Activity", icon: "bell", onPress: () => setPanel("activity") },
      { label: "Archived cards", icon: "inbox", onPress: () => setPanel("archive") },
    ];
    if (can.manageColumns) options.push({ label: "Add column", icon: "plus", onPress: addColumn });
    if (can.manageBoard || can.deleteBoard) options.push({ label: "Board settings", icon: "settings", onPress: () => setPanel("settings") });
    sheet.show({ title: board.title, message: `${templateFor(board.kind).name} · you are ${board.role}`, options });
  }

  function pickFilter(kind: "label" | "assignee" | "priority") {
    const set = (v: string) => setFilter((f) => ({ ...f, [kind]: v }));
    const current = filter[kind];
    const items =
      kind === "label"
        ? board.labels.map((l) => ({ value: l.id, label: l.name || l.color }))
        : kind === "assignee"
          ? board.members.map((m) => ({ value: m.userId, label: m.name }))
          : [...CARD_PRIORITIES].reverse().map((p) => ({ value: p, label: PRIORITY[p]!.label }));
    sheet.show({
      title: kind === "label" ? "Filter by label" : kind === "assignee" ? "Filter by assignee" : "Filter by priority",
      options: [
        { label: kind === "label" ? "All labels" : kind === "assignee" ? "Any assignee" : "Any priority", selected: !current, onPress: () => set("") },
        ...items.map((it) => ({ label: it.label, selected: current === it.value, onPress: () => set(it.value) })),
      ],
    });
  }

  const labelName = board.labels.find((l) => l.id === filter.label);
  const memberName = board.members.find((m) => m.userId === filter.assignee)?.name;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <HeaderButton icon="search" label={filterOpen ? "Hide filters" : "Filter cards"} active={filterActive || filterOpen} onPress={() => setFilterOpen((o) => !o)} />
              <HeaderButton icon="more" label="Board menu" onPress={boardMenu} />
            </View>
          ),
        }}
      />

      {board.archived ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Chip label="This board is archived" tone="warning" />
        </View>
      ) : null}

      {filterOpen || filterActive ? (
        <View style={styles.filters}>
          <Field
            value={filter.text}
            onChangeText={(t) => setFilter((f) => ({ ...f, text: t }))}
            placeholder="Filter cards…"
            autoCorrect={false}
            accessibilityLabel="Filter cards by text"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }} keyboardShouldPersistTaps="handled">
            {board.labels.length > 0 ? (
              <Pill label={labelName ? `Label: ${labelName.name || labelName.color}` : "Label"} active={!!filter.label} onPress={() => pickFilter("label")} />
            ) : null}
            <Pill label={memberName ? `Assignee: ${memberName}` : "Assignee"} active={!!filter.assignee} onPress={() => pickFilter("assignee")} />
            <Pill label={filter.priority ? `Priority: ${PRIORITY[filter.priority]?.label}` : "Priority"} active={!!filter.priority} onPress={() => pickFilter("priority")} />
            {filterActive ? <Button title="Clear" size="sm" variant="link" onPress={() => setFilter(NO_FILTER)} /> : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Column tabs: jump straight to a column. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {columns.map((c, i) => (
          <Pill key={c.id} label={`${c.title} · ${c.cardTotal}`} active={page === i} onPress={() => goTo(i)} />
        ))}
      </ScrollView>

      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {columns.length === 0 && !can.manageColumns ? (
          <Text variant="small" style={{ textAlign: "center", padding: 24 }}>This board has no columns yet.</Text>
        ) : height > 0 ? (
          <FlatList
            ref={listRef}
            horizontal
            data={pages}
            keyExtractor={(p) => (p === "add" ? "__add" : p.id)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={colW + GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingLeft: 16, paddingRight: Math.max(16, screenW - colW - 16), paddingBottom: 12 }}
            ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
            getItemLayout={(_d, index) => ({ length: colW + GAP, offset: 16 + index * (colW + GAP), index })}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (colW + GAP)))}
            renderItem={({ item, index }) =>
              item === "add" ? (
                <Pressable
                  onPress={addColumn}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.addColumn, { width: colW, height: height - 12 }, pressed && { borderColor: colors.brand }]}
                >
                  <Icon name="plus" size={22} color={colors.muted} />
                  <Text variant="small">Add column</Text>
                </Pressable>
              ) : (
                <BoardColumn
                  column={item}
                  cards={filterActive ? item.cards.filter((c) => cardMatches(c, filter)) : item.cards}
                  width={colW}
                  height={height - 12}
                  filterActive={filterActive}
                  canEdit={can.editCards}
                  canManage={can.manageColumns}
                  loadingMore={loadingMore === item.id}
                  refreshing={refreshing}
                  onRefresh={() => void refresh()}
                  onLoadMore={() => void loadMore(item.id)}
                  onOpenCard={(c) => router.push(`/boards/card/${c.id}` as Href)}
                  onCardMenu={cardMenu}
                  onColumnMenu={() => columnMenu(item, index)}
                  onAddCard={(t) => addCard(item.id, t)}
                />
              )
            }
          />
        ) : null}
      </View>

      <MoveCardSheet
        visible={!!moving}
        card={moving}
        columns={columns}
        onClose={() => setMoving(null)}
        onMove={(toColumnId, toIndex) => moving && void moveCard(moving, toColumnId, toIndex)}
      />
      <MembersSheet board={board} visible={panel === "members"} onClose={() => setPanel(null)} />
      <LabelsSheet board={board} visible={panel === "labels"} onClose={() => setPanel(null)} />
      <ActivitySheet boardId={board.id} visible={panel === "activity"} onClose={() => setPanel(null)} />
      <ArchiveSheet board={board} visible={panel === "archive"} onClose={() => setPanel(null)} />
      <SettingsSheet board={board} visible={panel === "settings"} onClose={() => setPanel(null)} />
      {sheet.element}
      {prompt.element}
    </KeyboardAvoidingView>
  );
}

/** Destructive confirm. */
function confirmDelete(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBtn: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  filters: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tabs: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  addColumn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
