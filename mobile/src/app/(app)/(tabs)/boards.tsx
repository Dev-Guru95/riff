// Projects — the web's /boards at phone width: PageHeader, global search, the
// project Dashboard, then "Your boards" with "+ New board" (template picker)
// and the boards the user belongs to.
// Data: GET /api/boards, GET /api/mobile/boards/dashboard, GET /api/search?q=,
// POST /api/boards.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Dashboard, MY_TASKS_PATH } from "@/components/boards/MyTasks";
import { CreateBoardSheet } from "@/components/boards/CreateBoardSheet";
import { ProjectSearch } from "@/components/boards/ProjectSearch";
import { useBoardAction } from "@/components/boards/useBoardAction";
import { BOARD_TEMPLATES, capitalize, templateFor } from "@/components/boards/utils";
import { Button, Card, PageHeader, QueryView, Text } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { BoardSummary, BoardsResponse } from "@/types/boards";

function BoardRow({ b }: { b: BoardSummary }) {
  const tpl = templateFor(b.kind);
  return (
    <Card
      onPress={() => router.push(`/boards/${b.id}` as Href)}
      accessibilityLabel={`${b.title}, ${b.cardCount} cards, ${b.memberCount} members, ${b.role}`}
      style={styles.board}
    >
      <Text style={{ fontSize: 24, lineHeight: 30 }}>{tpl.icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" numberOfLines={1}>{b.title}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>{b.kind === "generic" ? "Board" : tpl.name}</Text>
        <View style={styles.meta}>
          <Text variant="caption">🗒️ {b.cardCount}</Text>
          <Text variant="caption">👥 {b.memberCount}</Text>
          <View style={styles.role}>
            <Text variant="caption">{capitalize(b.role)}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/**
 * The empty state: start straight from a template, named after it.
 *
 * It used to be a single "No boards yet" card with the templates hidden behind
 * the "+ New board" button, so the page read as a dead end — the web fixed that
 * first (BoardsClient.tsx) and this is the same grid.
 */
function StarterBoards({ onBlank }: { onBlank: () => void }) {
  const { run, busy } = useBoardAction();

  async function startFrom(kind: string, name: string) {
    if (busy) return;
    const res = await run<{ id: string }>("/api/boards", {
      body: { title: name, kind },
      invalidates: ["/api/boards", MY_TASKS_PATH],
      alertErrors: true,
    });
    if (res?.id) router.push(`/boards/${res.id}` as Href);
  }

  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontSize: 36, lineHeight: 44, marginBottom: 8 }}>🗂️</Text>
        <Text weight="semibold">Start your first board</Text>
        <Text variant="small" style={{ marginTop: 4, textAlign: "center" }}>
          Pick a starter below — each one opens with the right columns and labels already set up.
        </Text>
      </View>
      <View style={styles.starters}>
        {BOARD_TEMPLATES.filter((t) => t.kind !== "generic").map((t) => (
          <Pressable
            key={t.kind}
            onPress={() => void startFrom(t.kind, t.name)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Start a ${t.name}. ${t.tagline}`}
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [styles.starter, busy && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 24, lineHeight: 30 }}>{t.icon}</Text>
              {t.track ? (
                <View style={styles.role}>
                  <Text variant="caption" style={{ fontSize: 10, lineHeight: 14 }}>Track {t.track}</Text>
                </View>
              ) : null}
            </View>
            <Text weight="medium" style={{ marginTop: 8 }}>{t.name}</Text>
            <Text variant="caption" numberOfLines={2}>{t.tagline}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Or start a blank board" variant="link" onPress={onBlank} style={{ alignSelf: "center", marginTop: 12 }} />
    </View>
  );
}

export default function Boards() {
  const query = useApiQuery<BoardsResponse>("/api/boards");
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const invalidate = useInvalidate();

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([query.refetch(), invalidate(MY_TASKS_PATH)]);
    } finally {
      setRefreshing(false);
    }
  }

  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <PageHeader title="Projects" subtitle="Plan and track your work on kanban boards" />
      <ProjectSearch />
      <Dashboard />
      <Text weight="semibold" accessibilityRole="header">Your boards</Text>
      <Button title="+ New board" onPress={() => setCreating(true)} accessibilityLabel="New board" />
    </View>
  );

  return (
    <View style={styles.root}>
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.boards}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => <BoardRow b={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListHeaderComponent={header}
            ListEmptyComponent={<StarterBoards onBlank={() => setCreating(true)} />}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        )}
      </QueryView>
      <CreateBoardSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  board: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  meta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  role: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  starter: {
    width: "48%",
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 120,
  },
});
