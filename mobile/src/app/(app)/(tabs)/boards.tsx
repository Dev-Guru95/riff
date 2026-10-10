// Projects — the web's /boards at phone width: PageHeader, global search, the
// project Dashboard, then "Your boards" with "+ New board" (template picker)
// and the boards the user belongs to.
// Data: GET /api/boards, GET /api/mobile/boards/dashboard, GET /api/search?q=,
// POST /api/boards.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { Dashboard, MY_TASKS_PATH } from "@/components/boards/MyTasks";
import { CreateBoardSheet } from "@/components/boards/CreateBoardSheet";
import { ProjectSearch } from "@/components/boards/ProjectSearch";
import { capitalize, templateFor } from "@/components/boards/utils";
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
            ListEmptyComponent={
              // The web's own empty card (BoardsClient.tsx), not the generic EmptyState.
              <Card style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ fontSize: 36, lineHeight: 44, marginBottom: 8 }}>🗂️</Text>
                <Text weight="semibold">No boards yet</Text>
                <Text variant="small" style={{ marginTop: 4, textAlign: "center" }}>
                  Create your first board — pick a tool like Content Calendar or Release Planner to get started fast.
                </Text>
              </Card>
            }
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
});
