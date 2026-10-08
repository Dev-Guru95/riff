// AI Career Roadmap — the web's /roadmap (RoadmapClient): one plan per
// horizon, generate / regenerate via POST /api/roadmap { horizon }.
// Data: GET /api/mobile/roadmaps.

import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import { Button, Card, PageHeader, Pill, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts } from "@/theme/tokens";
import type { RoadmapHorizon, RoadmapsResponse } from "@/types/api";

// Labels live in the web client component, not the API (docs/MOBILE_API.md §5).
const HORIZONS: { key: RoadmapHorizon; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
];

export default function Roadmap() {
  const query = useApiQuery<RoadmapsResponse>("/api/mobile/roadmaps");
  const [horizon, setHorizon] = useState<RoadmapHorizon>("30d");
  const generate = useApiMutation({ invalidates: ["/api/mobile/roadmaps"], success: "Roadmap ready" });
  const label = HORIZONS.find((h) => h.key === horizon)!.label;
  const loading = generate.isPending && generate.variables?.body !== undefined && (generate.variables.body as { horizon: string }).horizon === horizon;
  const run = () => generate.mutate({ path: "/api/roadmap", body: { horizon } });

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Roadmap" }} />
      <PageHeader title="🧭 AI Career Roadmap" subtitle="Personalized growth plans based on your goals, genre, audience, and performance." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="tablist">
        {HORIZONS.map((h) => (
          <Pill key={h.key} label={h.label} active={horizon === h.key} onPress={() => setHorizon(h.key)} />
        ))}
      </View>
      <QueryView query={query}>
        {(d) => {
          const current = d.plans[horizon];
          if (!current)
            return (
              <Card style={{ alignItems: "center", gap: 14, padding: 24 }}>
                <Text variant="small">No {label} plan yet.</Text>
                <Button
                  title={loading ? "Generating…" : `Generate my ${label} roadmap`}
                  loading={loading}
                  disabled={generate.isPending}
                  onPress={run}
                  style={{ alignSelf: "center" }}
                />
              </Card>
            );
          return (
            <View style={{ gap: 12 }}>
              <Card>
                <Text style={{ lineHeight: 22 }}>{current.summary}</Text>
              </Card>
              {current.milestones.map((m, i) => (
                <Card key={i} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.white, fontFamily: fonts.semibold }}>{i + 1}</Text>
                    </View>
                    <Text weight="semibold" style={{ flex: 1 }}>{m.title}</Text>
                  </View>
                  {m.tasks.map((t, ti) => (
                    <View key={ti} style={{ flexDirection: "row", gap: 8 }}>
                      <Text color={colors.accent}>○</Text>
                      <Text style={{ flex: 1 }}>{t}</Text>
                    </View>
                  ))}
                </Card>
              ))}
              <Button
                title={loading ? "Regenerating…" : "Regenerate from my latest data"}
                variant="ghost"
                fullWidth
                loading={loading}
                disabled={generate.isPending}
                onPress={run}
              />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
