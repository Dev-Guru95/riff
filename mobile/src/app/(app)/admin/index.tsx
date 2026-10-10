// Admin overview — the web's /admin (src/app/(admin)/admin/page.tsx) at phone
// width: 2-column stat tiles, the 30-day activity KPIs, the engagement funnel
// (GoalBar rows), "Critical" attention rows and signup sources, in that order.
// Section nav lives in the shell's menu (AdminNav). Data: GET /api/mobile/admin/overview.

import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, type Href } from "expo-router";

import { CardTitle, MONO } from "@/components/admin/controls";
import { Card, Icon, PageHeader, QueryView, Screen, StatCard, Text, type IconName } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts, gradients, radius } from "@/theme/tokens";
import type { AdminOverviewResponse } from "@/types/api";

/** Web Kpi: bordered box, text-lg bold value, text-xs muted label, centred. */
function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ width: "48%", flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, alignItems: "center" }}>
      <Text style={{ fontSize: 18, lineHeight: 28, fontFamily: fonts.bold }}>{String(value)}</Text>
      <Text variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/** Web GoalBar with a FunnelLabel: "text … count" row, then a 6px bar and the % trailing it. */
function GoalBar({ text, value, pct }: { text: string; value: number; pct: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <Text style={{ flex: 1 }}>{text}</Text>
        <Text variant="caption">{String(value)}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: "hidden" }}
          accessibilityRole="progressbar"
          accessibilityLabel={text}
          accessibilityValue={{ min: 0, max: 100, now: safe }}
        >
          <LinearGradient {...gradients.progress} style={{ width: `${safe}%`, height: "100%", borderRadius: radius.pill }} />
        </View>
        <Text variant="caption" style={{ width: 36, textAlign: "right" }}>{safe}%</Text>
      </View>
    </View>
  );
}

function AttentionRow({ label, value, href, last }: { label: string; value: number; href: Href; last?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, minHeight: 44 },
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text variant="small" style={{ flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text weight="bold" color={value > 0 ? colors.brand : colors.muted}>{String(value)}</Text>
        <Icon name="chevronRight" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}

export default function AdminOverview() {
  const query = useApiQuery<AdminOverviewResponse>("/api/mobile/admin/overview");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Overview" }} />
      <PageHeader title="Overview" subtitle="Your audience in one place" />

      <QueryView query={query}>
        {(d) => {
          const cards: { label: string; value: string | number; icon: IconName }[] = [
            { label: "Artists", value: d.counts.artists, icon: "community" },
            { label: "Courses", value: d.counts.courses, icon: "graduation" },
            { label: "Lessons", value: d.counts.lessons, icon: "book" },
            { label: "Submissions", value: d.counts.submissions, icon: "clipboard" },
            { label: "Quiz attempts", value: d.counts.quizAttempts, icon: "target" },
            { label: "Course completion", value: `${d.completionRate}%`, icon: "check" },
          ];
          return (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {cards.map((c) => (
                  <View key={c.label} style={{ width: "47%", flexGrow: 1 }}>
                    <StatCard value={c.value} label={c.label} icon={c.icon} />
                  </View>
                ))}
              </View>

              <Card style={{ padding: 20 }}>
                <CardTitle style={{ marginBottom: 16 }}>Activity (last {d.kpis.days} days)</CardTitle>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <Kpi label="Active users" value={d.kpis.activeUsers} />
                  <Kpi label="Lessons done" value={d.kpis.lessonCompletions} />
                  <Kpi label="Quiz passes" value={d.kpis.quizPasses} />
                  <Kpi label="Submissions" value={d.kpis.assignmentSubmits} />
                  <Kpi label="Coach msgs" value={d.kpis.coachMessages} />
                  <Kpi label="Audits run" value={d.kpis.auditRuns} />
                  <Kpi label="Missions" value={d.kpis.missionCompletions} />
                  <Kpi label="Signups" value={d.kpis.signups} />
                </View>
              </Card>

              <Card style={{ padding: 20 }}>
                <CardTitle style={{ marginBottom: 16 }}>Engagement funnel</CardTitle>
                <View style={{ gap: 12 }}>
                  {d.funnel.map((f) => (
                    <GoalBar key={f.label} text={f.label} value={f.value} pct={f.pct} />
                  ))}
                </View>
                <Text variant="caption" style={{ marginTop: 16 }}>
                  Activation rate: <Text variant="caption" weight="bold" color={colors.foreground}>{d.activationRate}%</Text>
                </Text>
              </Card>

              <Card style={{ padding: 20 }}>
                <CardTitle style={{ marginBottom: 6 }}>Critical</CardTitle>
                <AttentionRow label="Submissions flagged for review" value={d.counts.flaggedSubmissions} href="/admin/submissions" />
                <AttentionRow label="AI content suggestions pending" value={d.counts.pendingContent} href="/admin/content" last />
              </Card>

              <Card style={{ padding: 20 }}>
                <CardTitle style={{ marginBottom: 16 }}>Signup source</CardTitle>
                {d.signupSources.length === 0 ? (
                  <Text variant="small">No signups yet.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {d.signupSources.map((s) => (
                      <View key={s.source ?? "direct"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <Text color={s.source ? undefined : colors.muted} style={{ flex: 1 }}>{s.source ?? "Direct / untagged"}</Text>
                        <Text weight="bold">{String(s.count)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text variant="caption" style={{ marginTop: 12 }}>
                  Tagged by the <Text variant="caption" style={{ fontFamily: MONO }}>?ref=</Text> on the link the artist arrived through.
                </Text>
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
