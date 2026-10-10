// Notifications — the web's NotificationBell dropdown as a full screen.
// Data: GET /api/notifications (latest 30 + unread count, shared with the tab
// bar bell). Like the web, opening the list marks everything read
// (POST /api/notifications with no id) while the rows that were unread keep
// their highlight until you leave.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { post } from "@/api/client";
import { QueryView, Text } from "@/components/ui";
import { useNotifications, type NotificationItem, type NotificationsResponse } from "@/hooks/useNotifications";
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

function Row({ n, highlight }: { n: NotificationItem; highlight: boolean }) {
  const inner = (
    <View style={[styles.row, highlight && styles.unread]}>
      <View style={styles.titleLine}>
        <Text style={styles.icon}>{ICON[n.type] ?? "🔔"}</Text>
        <Text weight="medium" style={{ flex: 1 }}>{n.title}</Text>
      </View>
      {n.body ? <Text variant="caption" style={{ marginLeft: 24 }}>{n.body}</Text> : null}
    </View>
  );
  if (!n.link) return inner;
  const link = n.link;
  return (
    <Pressable
      onPress={() => void openLink(link)}
      accessibilityRole="link"
      accessibilityLabel={`${n.title}${n.body ? `. ${n.body}` : ""}`}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      {inner}
    </Pressable>
  );
}

export default function Notifications() {
  const query = useNotifications();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Ids that were unread when the screen opened: they stay highlighted, as in
  // the web dropdown, even though the server has marked them read.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    const data = query.data;
    if (!data || marked.current) return;
    marked.current = true;
    setFresh(new Set(data.items.filter((n) => !n.read).map((n) => n.id)));
    if (data.unread > 0) {
      // Clear the badge immediately, then persist like the web (POST, no id).
      qc.setQueryData<NotificationsResponse>(["/api/notifications"], (d) => (d ? { ...d, unread: 0 } : d));
      post("/api/notifications").catch(() => {
        void qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      });
    }
  }, [query.data, qc]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Notifications" }} />
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.items}
            keyExtractor={(n) => n.id}
            extraData={fresh}
            renderItem={({ item }) => <Row n={item} highlight={!item.read || !!fresh?.has(item.id)} />}
            ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
            ListEmptyComponent={<Text variant="small" style={styles.empty}>No notifications yet.</Text>}
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
  row: { padding: 10, borderRadius: radius.md, gap: 2 },
  unread: { backgroundColor: colors.surface2 },
  titleLine: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  icon: { width: 16, fontSize: 14, lineHeight: 20 },
  empty: { textAlign: "center", paddingVertical: 24 },
});
