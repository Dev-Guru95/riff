// Projects — the web's /boards: global search, "New board" (template picker)
// and the boards the user belongs to.
// Data: GET /api/boards, GET /api/search?q=, POST /api/boards.
//
// Plus the personal "my work" panel (GET /api/mobile/boards/dashboard).

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { MyTasks, MY_TASKS_PATH } from "@/components/boards/MyTasks";
import { CreateBoardSheet } from "@/components/boards/CreateBoardSheet";
import { ProjectSearch } from "@/components/boards/ProjectSearch";
import { templateFor } from "@/components/boards/utils";
import { Button, Card, Chip, EmptyState, Icon, PageHeader, QueryView, Text } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { BoardSummary, BoardsResponse } from "@/types/boards";

function BoardRow({ b }: { b: BoardSummary }) {
  const tpl = templateFor(b.kind);
  return (
    <Card onPress={() => router.push(`/boards/${b.id}` as Href)} accessibilityLabel={`${b.title}, ${b.cardCount} cards, ${b.memberCount} members`} style={styles.board}>
      <Text style={{ fontSize: 24, lineHeight: 30 }}>{tpl.icon}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text weight="semibold" numberOfLines={1}>{b.title}</Text>
        <Text variant="caption">{b.kind === "generic" ? "Board" : tpl.name}</Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Icon name="card" size={13} color={colors.muted} />
            <Text variant="caption">{b.cardCount}</Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="community" size={13} color={colors.muted} />
            <Text variant="caption">{b.memberCount}</Text>
          </View>
          {b.archived ? <Chip label="Archived" tone="warning" /> : null}
          <View style={{ marginLeft: "auto" }}>
            <Chip label={b.role} />
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
      <PageHeader
        title="Projects"
        subtitle="Plan and track your work on kanban boards"
        right={<Button title="New" icon="plus" size="sm" onPress={() => setCreating(true)} accessibilityLabel="New board" />}
      />
      <ProjectSearch />
      <MyTasks />
      <Text variant="label" accessibilityRole="header">Your boards</Text>
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
              <EmptyState
                title="No boards yet"
                icon="kanban"
                body="Create your first board — pick a tool like Content Calendar or Release Planner to get started fast."
                action={{ label: "New board", onPress: () => setCreating(true) }}
              />
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
  meta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
});
