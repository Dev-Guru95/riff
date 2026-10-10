// AI Career Roadmap — the web's /roadmap (RoadmapClient): one plan per
// horizon, generate / regenerate via POST /api/roadmap { horizon }.
// Data: GET /api/mobile/roadmaps.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button, Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius } from "@/theme/tokens";
import type { RoadmapHorizon, RoadmapPlan, RoadmapsResponse } from "@/types/api";

// Labels live in the web client component, not the API (docs/MOBILE_API.md §5).
const HORIZONS: { key: RoadmapHorizon; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
];

type GenerateResponse = { id: string; horizon: RoadmapHorizon; plan: RoadmapPlan };

export default function Roadmap() {
  const query = useApiQuery<RoadmapsResponse>("/api/mobile/roadmaps");
  const qc = useQueryClient();
  const [horizon, setHorizon] = useState<RoadmapHorizon>("30d");
  // Like the web, show the new plan straight from the POST response.
  const generate = useApiMutation<GenerateResponse>({
    onSuccess: (d) => {
      qc.setQueryData<RoadmapsResponse>(["/api/mobile/roadmaps"], (old) => ({
        plans: { ...(old?.plans ?? {}), [d.horizon]: d.plan },
      }));
    },
  });
  const label = HORIZONS.find((h) => h.key === horizon)!.label;
  const loading = generate.isPending;
  const run = () => generate.mutate({ path: "/api/roadmap", body: { horizon } });

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Roadmap" }} />
      <PageHeader title="🧭 AI Career Roadmap" subtitle="Personalized growth plans based on your goals, genre, audience, and performance." />
      <View style={styles.tabs} accessibilityRole="tablist">
        {HORIZONS.map((h) => {
          const active = horizon === h.key;
          return (
            <Pressable
              key={h.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setHorizon(h.key)}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ textAlign: "center" }} color={active ? colors.white : colors.muted}>
                {h.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <QueryView query={query}>
        {(d) => {
          const current = d.plans[horizon];
          if (!current)
            return (
              <Card style={{ alignItems: "center", padding: 32 }}>
                <Text color={colors.muted} style={styles.base}>
                  No {label} plan yet.
                </Text>
                <Button
                  title={loading ? "Generating…" : `Generate my ${label} roadmap`}
                  disabled={loading}
                  onPress={run}
                  style={{ alignSelf: "center", marginTop: 16 }}
                />
              </Card>
            );
          return (
            <View style={{ gap: 16 }}>
              <Card style={{ padding: 20 }}>
                <Text style={{ lineHeight: 23 }}>{current.summary}</Text>
              </Card>
              <View style={{ gap: 12 }}>
                {current.milestones.map((m, i) => (
                  <Card key={i} style={{ padding: 20 }}>
                    <View style={styles.mHead}>
                      <View style={styles.num}>
                        <Text style={styles.numText}>{i + 1}</Text>
                      </View>
                      <Text weight="semibold" style={[styles.base, { flex: 1 }]}>{m.title}</Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {m.tasks.map((t, ti) => (
                        <View key={ti} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <Text color={colors.accent} style={{ marginTop: 2 }}>○</Text>
                          <Text style={{ flex: 1 }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
              </View>
              <Button
                title={loading ? "Regenerating…" : "Regenerate from my latest data"}
                variant="ghost"
                fullWidth
                disabled={loading}
                onPress={run}
              />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flexShrink: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  tabActive: { backgroundColor: colors.brand },
  base: { fontSize: 16, lineHeight: 24 },
  mHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 12, lineHeight: 16, color: colors.white, fontFamily: fonts.regular },
});
