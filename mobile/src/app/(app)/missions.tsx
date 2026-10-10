// Weekly Missions — the web's /missions: this week's challenges, each marked
// done via POST /api/missions/:id/complete.
// Data: GET /api/mobile/missions (creates the week's set on first visit, as the page does).

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { Button, Card, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { MissionItem, MissionsResponse } from "@/types/api";

const CATEGORY_ICON: Record<string, string> = { branding: "🎨", content: "📸", engagement: "💬", release: "🚀" };

function MissionCard({ mission }: { mission: MissionItem }) {
  const invalidate = useInvalidate();
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (later.current) clearTimeout(later.current);
  }, []);
  const [note, setNote] = useState<string | null>(null);
  const done = mission.status === "completed";
  const complete = useApiMutation<{ xp?: { awarded: number } | null; streak?: { currentLen: number } | null }>({
    onSuccess: (d) => {
      // Like the web: show the reward inline for a moment, then refresh.
      setNote(`+${d.xp?.awarded ?? mission.xpReward} XP${d.streak?.currentLen ? ` · 🔥 ${d.streak.currentLen}-day streak` : ""}`);
      later.current = setTimeout(() => {
        setNote(null);
        void invalidate("/api/mobile/missions", "/api/mobile/dashboard", "/api/mobile/leaderboard");
      }, 1800);
    },
  });

  return (
    <Card style={{ padding: 20, opacity: done ? 0.7 : 1 }}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={{ fontSize: 18, lineHeight: 28 }}>{CATEGORY_ICON[mission.category] ?? "🎯"}</Text>
            <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24, flexShrink: 1 }}>{mission.title}</Text>
            <View style={styles.tag}>
              <Text variant="caption">{mission.category}</Text>
            </View>
          </View>
          <Text variant="small">{mission.description}</Text>
          <Text variant="caption" color={colors.accent} style={{ marginTop: 8 }}>+{mission.xpReward} XP</Text>
        </View>
        {done ? (
          <Text weight="medium" color={colors.success}>✓ Done</Text>
        ) : (
          <Button
            title={complete.isPending ? "…" : "Mark done"}
            size="sm"
            disabled={complete.isPending || !!note}
            onPress={() => complete.mutate({ path: `/api/missions/${mission.id}/complete` })}
            accessibilityLabel={`Mark ${mission.title} done`}
          />
        )}
      </View>
      {note ? <Text weight="semibold" color={colors.success} style={{ marginTop: 12 }}>{note}</Text> : null}
    </Card>
  );
}

export default function Missions() {
  const query = useApiQuery<MissionsResponse>("/api/mobile/missions");
  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Missions" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="title" accessibilityRole="header">🎯 Weekly Missions</Text>
              <Text variant="small">
                Real-world challenges that grow your career. Complete them for XP, badges, and leaderboard points.
                <Text variant="small" weight="medium" color={colors.foreground}> {d.completed}/{d.total} done.</Text>
              </Text>
            </View>
            <View style={{ gap: 12, marginTop: 8 }}>
              {d.missions.map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
              {d.missions.length === 0 ? <Text variant="small">No active missions right now. Check back soon!</Text> : null}
            </View>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
});
