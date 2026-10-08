// Admin overview — the web's /admin (admin/page.tsx) plus its sidebar nav,
// stacked into one column. Data: GET /api/mobile/admin/overview.

import { View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { ADMIN_SECTIONS, useStaffAccess } from "@/components/admin/access";
import { Button, Card, Chip, Divider, Icon, ListRow, ProgressBar, QueryView, Screen, Section, StatCard, Text, type IconName } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { AdminOverviewResponse } from "@/types/api";

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ width: "47.5%", flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, alignItems: "center" }}>
      <Text style={{ fontSize: 18, lineHeight: 24 }} weight="bold">{value}</Text>
      <Text variant="caption" numberOfLines={1}>{label}</Text>
    </View>
  );
}

function AttentionRow({ label, value, href }: { label: string; value: number; href: Href }) {
  return (
    <ListRow
      title={label}
      onPress={() => router.push(href)}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text weight="bold" color={value > 0 ? colors.brand : colors.muted}>{value}</Text>
          <Icon name="chevronRight" size={14} color={colors.muted} />
        </View>
      }
    />
  );
}

export default function AdminOverview() {
  const query = useApiQuery<AdminOverviewResponse>("/api/mobile/admin/overview");
  const { role, can } = useStaffAccess();

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Admin" }} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">Overview</Text>
          <Text variant="small">Your audience in one place</Text>
        </View>
        <Chip label={role || "staff"} tone="brand" icon="shield" />
      </View>

      <Section title="Sections">
        <Card padded={false} style={{ overflow: "hidden" }}>
          {ADMIN_SECTIONS.map((s, i) => (
            <View key={s.label}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={s.icon}
                title={s.label}
                subtitle={s.writeRole && !can(s.writeRole) ? `${s.body} · view only` : s.body}
                onPress={() => router.push(s.href)}
              />
            </View>
          ))}
        </Card>
        <Button title="‹ Artist view" variant="ghost" fullWidth onPress={() => router.dismissTo("/")} />
      </Section>

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
                  <View key={c.label} style={{ width: "47.5%", flexGrow: 1 }}>
                    <StatCard value={c.value} label={c.label} icon={c.icon} />
                  </View>
                ))}
              </View>

              <Card style={{ gap: 12 }}>
                <Text variant="label">Activity (last {d.kpis.days} days)</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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

              <Card style={{ gap: 14 }}>
                <Text variant="label">Engagement funnel</Text>
                {d.funnel.map((f) => (
                  <View key={f.label} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ flex: 1 }}>{f.label}</Text>
                      <Text variant="caption">{f.value} · {f.pct}%</Text>
                    </View>
                    <ProgressBar pct={f.pct} height={6} />
                  </View>
                ))}
                <Text variant="caption">
                  Activation rate: <Text variant="caption" weight="bold" color={colors.foreground}>{d.activationRate}%</Text>
                </Text>
              </Card>

              <Card padded={false} style={{ overflow: "hidden" }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <Text variant="label">Critical</Text>
                </View>
                <AttentionRow label="Submissions flagged for review" value={d.counts.flaggedSubmissions} href="/admin/submissions" />
                <Divider />
                <AttentionRow label="AI content suggestions pending" value={d.counts.pendingContent} href="/admin/content" />
              </Card>

              <Card style={{ gap: 10 }}>
                <Text variant="label">Signup source</Text>
                {d.signupSources.length === 0 ? (
                  <Text variant="small">No signups yet.</Text>
                ) : (
                  d.signupSources.map((s) => (
                    <View key={s.source ?? "direct"} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text color={s.source ? undefined : colors.muted} style={{ flex: 1 }}>{s.source ?? "Direct / untagged"}</Text>
                      <Text weight="bold">{s.count}</Text>
                    </View>
                  ))
                )}
                <Text variant="caption">Tagged by the ?ref= on the link the artist arrived through.</Text>
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
