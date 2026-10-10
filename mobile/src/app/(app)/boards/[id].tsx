// A board — the web's /boards/[id] (BoardView) as a native Kanban. Top to
// bottom like the web at phone width: the board header (template icon, title —
// tap to rename —, Archived badge, member initials, Members / Activity /
// Archived / Delete), the filter bar, then the columns. Columns are
// horizontally paged (one ~88%-wide column per page, snap scrolling) with
// column tabs to jump between them. Drag-and-drop becomes "Move to…" (long-press
// a card). Board drawers are native sheets. `?card=<id>` (search, dashboard,
// notifications) opens that card on arrival.
//
// Data: GET /api/boards/[id] (first 50 cards per column) + GET
// /api/columns/[id]/cards?offset= for the rest. Like the web's reload(), a
// refetch keeps every column's "Load more" depth instead of collapsing back to
// the first page. Writes go to the same routes the web uses; the server
// enforces BoardCapabilities, the UI hides what `can` denies.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { get } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { BoardColumn, type ColumnView } from "@/components/boards/BoardColumn";
import { ActivitySheet, ArchiveSheet, LabelsSheet, MembersSheet, SettingsSheet } from "@/components/boards/BoardPanels";
import { Initials, SelectField } from "@/components/boards/bits";
import { MoveCardSheet } from "@/components/boards/MoveCardSheet";
import { MY_TASKS_PATH } from "@/components/boards/MyTasks";
import { useActionSheet, usePrompt, type SheetOption } from "@/components/boards/Sheet";
import { useBoardAction } from "@/components/boards/useBoardAction";
import { PRIORITY, PRIORITY_FILTER_OPTIONS, templateFor } from "@/components/boards/utils";
import { Button, Icon, Pill, QueryView, ScreenSkeleton, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { BoardCardDTO, BoardDTO, BoardResponse, ColumnCardsResponse } from "@/types/boards";

type Filter = { text: string; label: string; assignee: string; priority: string };
const NO_FILTER: Filter = { text: "", label: "", assignee: "", priority: "" };
type Panel = "members" | "labels" | "activity" | "archive" | "settings" | null;
type Extra = { stamp: number; map: Record<string, BoardCardDTO[]> };

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

/** Fetch further pages of one column until `want` cards are loaded (or the column ends). */
async function fillColumn(col: BoardDTO["columns"][number], have: BoardCardDTO[], want: number, cancelled: () => boolean) {
  let list = have;
  let guard = 0;
  while (!cancelled() && col.cards.length + list.length < Math.min(want, col.cardTotal) && guard++ < 40) {
    const res = await get<ColumnCardsResponse>(`/api/columns/${col.id}/cards`, { offset: col.cards.length + list.length });
    if (!res.cards.length) break;
    list = [...list, ...res.cards];
  }
  return list;
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

  return (
    <View style={styles.root}>
      {/* The board title is shown (and renamed) in the body header, as on the web. */}
      <Stack.Screen options={{ title: "" }} />
      <QueryView query={query} skeleton={<ScreenSkeleton rows={3} />}>
        {(d) => <Board board={d.board} stamp={query.dataUpdatedAt} refetch={query.refetch} />}
      </QueryView>
    </View>
  );
}

function Board({ board, stamp, refetch }: { board: BoardDTO; stamp: number; refetch: () => Promise<unknown> }) {
  const { width: screenW } = useWindowDimensions();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { run } = useBoardAction();
  const sheet = useActionSheet();
  const prompt = usePrompt();
  const path = `/api/boards/${board.id}`;
  // Card/column writes change this board, the boards list counts and the dashboard.
  const inv = useMemo(() => [path, "/api/boards", MY_TASKS_PATH], [path]);
  const can = board.can;

  // ---- Filter ---------------------------------------------------------------
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const filterActive = !!(filter.text || filter.label || filter.assignee || filter.priority);

  // ---- Pagination -----------------------------------------------------------
  // Cards fetched beyond the first page, per column, for the board fetch `stamp`.
  // After a refetch (new stamp) the previous pages stay on screen (de-duplicated
  // against the fresh first pages) while the same depth is re-fetched, so
  // "Load more" never collapses after a mutation.
  const [extra, setExtra] = useState<Extra>({ stamp, map: {} });
  const extraRef = useRef(extra);
  const syncing = useRef(false);
  const commit = useCallback((e: Extra) => {
    extraRef.current = e;
    setExtra(e);
  }, []);

  const columns: ColumnView[] = useMemo(() => {
    const firstIds = new Set(board.columns.flatMap((c) => c.cards.map((x) => x.id)));
    const used = new Set<string>();
    return board.columns.map((c) => {
      const more = (extra.map[c.id] ?? []).filter((x) => {
        if (firstIds.has(x.id) || used.has(x.id)) return false;
        used.add(x.id);
        return true;
      });
      return { id: c.id, title: c.title, cardTotal: c.cardTotal, cards: [...c.cards, ...more] };
    });
  }, [board.columns, extra]);

  // Re-fill after a refetch, and load every page while a filter is active (so
  // matches and the "N match" counts cover the whole board, like the web).
  useEffect(() => {
    const cur = extraRef.current;
    const fresh = cur.stamp === stamp;
    const want = (c: BoardDTO["columns"][number]) => (filterActive ? c.cardTotal : c.cards.length + (cur.map[c.id]?.length ?? 0));
    const needsFetch = board.columns.some((c) => {
      const have = c.cards.length + (fresh ? (cur.map[c.id]?.length ?? 0) : 0);
      return have < Math.min(want(c), c.cardTotal);
    });
    if (fresh && !needsFetch) return;
    let cancelled = false;
    syncing.current = true;
    void (async () => {
      const next: Record<string, BoardCardDTO[]> = {};
      try {
        for (const col of board.columns) {
          next[col.id] = await fillColumn(col, fresh ? (cur.map[col.id] ?? []) : [], want(col), () => cancelled);
          if (cancelled) return;
        }
      } catch {
        // Keep whatever loaded; the user can still tap "Load more".
      }
      if (cancelled) return;
      syncing.current = false;
      commit({ stamp, map: next });
    })();
    return () => {
      cancelled = true;
      syncing.current = false;
    };
  }, [stamp, filterActive, board.columns, commit]);

  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  async function loadMore(columnId: string) {
    const col = board.columns.find((c) => c.id === columnId);
    if (!col || syncing.current || loadingMore) return;
    setLoadingMore(columnId);
    try {
      const cur = extraRef.current.stamp === stamp ? extraRef.current.map : {};
      const have = cur[columnId] ?? [];
      const list = await fillColumn(col, have, col.cards.length + have.length + 1, () => false);
      const latest = extraRef.current.stamp === stamp ? extraRef.current.map : {};
      commit({ stamp, map: { ...latest, [columnId]: list } });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoadingMore(null);
    }
  }

  // ---- Paging ---------------------------------------------------------------
  const colW = Math.round(screenW * 0.88);
  const GAP = 12;
  const listRef = useRef<FlatList<ColumnView | "add">>(null);
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(0);
  const pages: (ColumnView | "add")[] = can.manageColumns ? [...columns, "add"] : columns;
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
    const res = await run(`/api/cards/${card.id}/move`, { body: { toColumnId, toIndex }, invalidates: [...inv, `/api/cards/${card.id}`], success: "Card moved" });
    if (res) {
      const idx = columns.findIndex((c) => c.id === toColumnId);
      if (idx >= 0 && toColumnId !== card.columnId) goTo(idx);
    }
  }

  async function addCard(columnId: string, title: string) {
    const res = await run(`/api/columns/${columnId}/cards`, { body: { title }, invalidates: inv });
    return !!res;
  }

  function addColumn() {
    prompt.show({
      title: "Add column",
      placeholder: "Column name…",
      confirmLabel: "Add",
      maxLength: 80,
      onSubmit: async (t) => {
        const res = await run(`${path}/columns`, { body: { title: t }, invalidates: [path] });
        if (res) setTimeout(() => goTo(columns.length), 400);
      },
    });
  }

  function renameColumn(col: ColumnView) {
    prompt.show({
      title: "Rename column",
      initial: col.title,
      maxLength: 80,
      onSubmit: (t) => {
        if (t !== col.title) void run(`/api/columns/${col.id}`, { method: "PATCH", body: { title: t }, invalidates: [path] });
      },
    });
  }

  function columnMenu(col: ColumnView, index: number) {
    const options: SheetOption[] = [{ label: "Rename", icon: "pencil", onPress: () => renameColumn(col) }];
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
      label: "Delete",
      icon: "close",
      destructive: true,
      onPress: () =>
        confirmDelete(`Delete column "${col.title}" and its cards?`, () =>
          void run(`/api/columns/${col.id}`, { method: "DELETE", invalidates: inv, success: "Column deleted" }).then((ok) => {
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
              { label: "Duplicate", icon: "layers" as const, onPress: () => void run(`/api/cards/${card.id}/duplicate`, { invalidates: inv, success: "Card duplicated" }) },
              {
                label: "Archive",
                icon: "inbox" as const,
                onPress: () => void run(`/api/cards/${card.id}`, { method: "PATCH", body: { archived: true }, invalidates: inv, success: "Card archived" }),
              },
            ]
          : []),
      ],
    });
  }

  function renameBoard() {
    prompt.show({
      title: "Rename board",
      initial: board.title,
      maxLength: 120,
      onSubmit: (t) => {
        if (t !== board.title) void run(path, { method: "PATCH", body: { title: t }, invalidates: [path, "/api/boards", MY_TASKS_PATH] });
      },
    });
  }

  function deleteBoard() {
    confirmDelete(
      "Delete this board and everything in it? This cannot be undone.",
      async () => {
        const res = await run(path, { method: "DELETE" });
        if (!res) return;
        // Leave the deleted board first so its query isn't refetched into a 404.
        if (router.canGoBack()) router.back();
        else router.replace("/boards" as Href);
        toast("Board deleted");
        setTimeout(() => void invalidate("/api/boards", MY_TASKS_PATH), 400);
      },
    );
  }

  function moreMenu() {
    const options: SheetOption[] = [{ label: "Labels", icon: "flag", onPress: () => setPanel("labels") }];
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
          : PRIORITY_FILTER_OPTIONS.map((p) => ({ value: p, label: PRIORITY[p]!.label }));
    const all = kind === "label" ? "All labels" : kind === "assignee" ? "Any assignee" : "Any priority";
    sheet.show({
      options: [
        { label: all, selected: !current, onPress: () => set("") },
        ...items.map((it) => ({ label: it.label, selected: current === it.value, onPress: () => set(it.value) })),
      ],
    });
  }

  const tpl = templateFor(board.kind);
  const label = board.labels.find((l) => l.id === filter.label);
  const memberName = board.members.find((m) => m.userId === filter.assignee)?.name;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={moreMenu} accessibilityRole="button" accessibilityLabel="More board actions" hitSlop={6} style={styles.headerBtn}>
              <Icon name="more" size={20} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />

      {/* ---- Header (web BoardHeader) ---- */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={{ fontSize: 18, lineHeight: 26 }} accessibilityLabel={tpl.name}>{tpl.icon}</Text>
          <Pressable
            onPress={can.manageBoard ? renameBoard : undefined}
            disabled={!can.manageBoard}
            accessibilityRole={can.manageBoard ? "button" : "header"}
            accessibilityHint={can.manageBoard ? "Rename board" : undefined}
            style={{ flexShrink: 1 }}
          >
            <Text style={styles.title} numberOfLines={2}>{board.title}</Text>
          </Pressable>
          {board.archived ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.warning}>Archived</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setPanel("members")} accessibilityRole="button" accessibilityLabel="Board members" style={styles.avatars}>
            {board.members.slice(0, 5).map((m, i) => (
              <View key={m.userId} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Initials name={m.name} size={28} />
              </View>
            ))}
            {board.members.length > 5 ? (
              <View style={{ marginLeft: -8 }}>
                <View style={styles.more}>
                  <Text style={{ fontSize: 10, lineHeight: 14 }}>+{board.members.length - 5}</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
          {can.manageMembers ? <Button title="Members" size="sm" variant="ghost" onPress={() => setPanel("members")} /> : null}
          <Button title="Activity" size="sm" variant="ghost" onPress={() => setPanel("activity")} />
          <Button title="Archived" size="sm" variant="ghost" onPress={() => setPanel("archive")} />
          {can.deleteBoard ? <Button title="Delete" size="sm" variant="ghost" onPress={deleteBoard} /> : null}
        </View>
      </View>

      {/* ---- Filter bar (web FilterBar) ---- */}
      <View style={styles.filters}>
        <TextInput
          value={filter.text}
          onChangeText={(t) => setFilter((f) => ({ ...f, text: t }))}
          placeholder="Filter cards…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          autoCorrect={false}
          accessibilityLabel="Filter cards"
          style={styles.filterInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          <SelectField value={label ? label.name || label.color : "All labels"} onPress={() => pickFilter("label")} accessibilityLabel="Label filter" style={styles.select} />
          <SelectField value={memberName ?? "Any assignee"} onPress={() => pickFilter("assignee")} accessibilityLabel="Assignee filter" style={styles.select} />
          <SelectField
            value={filter.priority ? (PRIORITY[filter.priority]?.label ?? filter.priority) : "Any priority"}
            onPress={() => pickFilter("priority")}
            accessibilityLabel="Priority filter"
            style={styles.select}
          />
          {filterActive ? <Button title="Clear filters" size="sm" variant="ghost" onPress={() => setFilter(NO_FILTER)} /> : null}
        </ScrollView>
      </View>

      {/* Column tabs: jump straight to a column (stands in for horizontal mouse scrolling). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {columns.map((c, i) => (
          <Pill key={c.id} label={`${c.title} · ${c.cardTotal}`} active={page === i} onPress={() => goTo(i)} />
        ))}
      </ScrollView>

      <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 ? (
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
                  style={({ pressed }) => [styles.addColumn, { width: colW }, pressed && { borderColor: colors.brand }]}
                >
                  <Text variant="small">+ Add column</Text>
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
                  onRename={() => renameColumn(item)}
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

/** Destructive confirm, worded like the web's confirm() prompts. */
function confirmDelete(message: string, onConfirm: () => void) {
  Alert.alert(message, undefined, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBtn: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { fontSize: 20, lineHeight: 28, fontFamily: fonts.bold, color: colors.foreground },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  avatars: { flexDirection: "row", alignItems: "center", minHeight: TOUCH, paddingRight: 4 },
  more: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 40,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
  },
  select: { minHeight: 40 },
  tabs: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  addColumn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 12,
    minHeight: TOUCH,
    justifyContent: "center",
  },
});
