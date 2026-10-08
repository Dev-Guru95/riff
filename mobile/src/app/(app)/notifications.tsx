// Notifications — the web's NotificationBell dropdown as a full screen.
// Data: GET /api/notifications (latest 30 + unread count, shared with the tab
// bar bell). Writes: POST /api/notifications { id } marks one read, {} marks all.

import { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, EmptyState, QueryView, Text } from "@/components/ui";
import { useApiMutation } from "@/hooks/useApi";
import { useNotifications, type NotificationItem } from "@/hooks/useNotifications";
import { openLink } from "@/lib/links";
import { colors, radius } from "@/theme/tokens";

const ICON: Record<string, string> = {
  badge: "🏅",
  levelup: "⬆️",
  mission: "🎯",
  audit: "📈",
  reward: "🎁",
  community: "💬",
  certificate: "🎓",
  system: "🔔",
  mention: "📣",
  comment: "💬",
  task: "✅",
  due: "⏰",
  board: "🗂️",
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Row({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}${n.body ? `. ${n.body}` : ""}`}
      style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && { opacity: 0.8 }]}
    >
      <Text style={{ fontSize: 18, lineHeight: 22 }}>{ICON[n.type] ?? "🔔"}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text weight="medium">{n.title}</Text>
        {n.body ? <Text variant="caption">{n.body}</Text> : null}
        <Text variant="caption" style={{ marginTop: 2 }}>{timeAgo(n.createdAt)}</Text>
      </View>
      {!n.read ? <View style={styles.dot} accessibilityElementsHidden /> : null}
    </Pressable>
  );
}

export default function Notifications() {
  const query = useNotifications();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const markOne = useApiMutation({ invalidates: ["/api/notifications"] });
  const markAll = useApiMutation({ invalidates: ["/api/notifications"], success: "All caught up" });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  function open(n: NotificationItem) {
    if (!n.read) markOne.mutate({ path: "/api/notifications", body: { id: n.id } });
    if (n.link) void openLink(n.link);
  }

  const unread = query.data?.unread ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () =>
            unread > 0 ? (
              <Button
                title="Mark all read"
                size="sm"
                variant="link"
                loading={markAll.isPending}
                onPress={() => markAll.mutate({ path: "/api/notifications", body: {} })}
              />
            ) : null,
        }}
      />
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.items}
            keyExtractor={(n) => n.id}
            renderItem={({ item }) => <Row n={item} onPress={() => open(item)} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListHeaderComponent={
              d.unread > 0 ? (
                <Text variant="caption" style={{ marginBottom: 10 }}>
                  {d.unread} unread
                </Text>
              ) : null
            }
            ListEmptyComponent={<EmptyState icon="bell" title="No notifications yet." body="Badges, level-ups, mentions and due dates show up here." />}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
            }
          />
        )}
      </QueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: { backgroundColor: colors.surface2, borderColor: colors.brand + "66" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand2, marginTop: 6 },
});
