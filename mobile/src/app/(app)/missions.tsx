// Weekly Missions — the web's /missions: this week's challenges, each marked
// done via POST /api/missions/:id/complete.
// Data: GET /api/mobile/missions (creates the week's set on first visit, as the page does).

import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import { Button, Card, Chip, EmptyState, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { MissionItem, MissionsResponse } from "@/types/api";

const CATEGORY_ICON: Record<string, string> = { branding: "🎨", content: "📸", engagement: "💬", release: "🚀" };

function MissionCard({ mission }: { mission: MissionItem }) {
  const toast = useToast();
  const [note, setNote] = useState<string | null>(null);
  const done = mission.status === "completed";
  const complete = useApiMutation<{ xp?: { awarded: number } | null; streak?: { currentLen: number } | null }>({
    invalidates: ["/api/mobile/missions", "/api/mobile/dashboard", "/api/mobile/leaderboard"],
    onSuccess: (d) => {
      const msg = `+${d.xp?.awarded ?? mission.xpReward} XP${d.streak?.currentLen ? ` · 🔥 ${d.streak.currentLen}-day streak` : ""}`;
      setNote(msg);
      toast(msg);
    },
  });

  return (
    <Card style={{ gap: 8, opacity: done ? 0.7 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 18 }}>{CATEGORY_ICON[mission.category] ?? "🎯"}</Text>
        <Text weight="semibold" style={{ flexShrink: 1 }}>{mission.title}</Text>
        <Chip label={mission.category} />
      </View>
      <Text variant="small">{mission.description}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <Text variant="caption" color={colors.accent}>+{mission.xpReward} XP</Text>
        {done ? (
          <Text variant="small" weight="medium" color={colors.success}>✓ Done</Text>
        ) : (
          <Button
            title="Mark done"
            size="sm"
            loading={complete.isPending}
            onPress={() => complete.mutate({ path: `/api/missions/${mission.id}/complete` })}
            accessibilityLabel={`Mark ${mission.title} done`}
          />
        )}
      </View>
      {note && !done ? <Text variant="small" weight="semibold" color={colors.success}>{note}</Text> : null}
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
            {d.missions.length === 0 ? (
              <EmptyState icon="target" title="No active missions right now." body="Check back soon!" />
            ) : (
              <View style={{ gap: 12 }}>
                {d.missions.map((m) => (
                  <MissionCard key={m.id} mission={m} />
                ))}
              </View>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
