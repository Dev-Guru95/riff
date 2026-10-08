// Career Dashboard — the web's /studio/dashboard (src/app/(app)/studio/dashboard/page.tsx).
// Data: GET /api/mobile/studio/dashboard (money in cents).

import { View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { money } from "@/components/studio/shared";
import { Button, Card, Icon, PageHeader, ProgressBar, QueryView, Screen, StatCard, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { StudioDashboardResponse } from "@/types/api";

function LinkCard({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Card onPress={() => router.push(href as Href)} accessibilityLabel={`${title}, ${detail}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ flex: 1 }}>
        <Text weight="medium">{title}</Text>
        <Text variant="small"> · {detail}</Text>
      </Text>
      <Icon name="chevronRight" size={16} color={colors.muted} />
    </Card>
  );
}

export default function CareerDashboard() {
  const query = useApiQuery<StudioDashboardResponse>("/api/mobile/studio/dashboard");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Career Dashboard" }} />
      <PageHeader title="Career Dashboard" subtitle="Your whole music career at a glance — pulled from across Riff." />
      <QueryView query={query}>
        {(d) => (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard value={d.level.levelName} label={`${d.level.totalXp} XP`} icon="zap" />
              <StatCard value={`${d.streak.currentLen}d`} label={`Streak · best ${d.streak.longestLen}d`} icon="flame" />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard value={d.badgeCount} label="Badges" icon="award" />
              <Card style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ position: "absolute", top: 12, right: 12 }}>
                  <Icon name="dollar" size={18} color={colors.muted} />
                </View>
                <Text
                  weight="bold"
                  style={{ fontSize: 20, lineHeight: 26 }}
                  color={d.finance.net < 0 ? colors.brand2 : colors.success}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {money(d.finance.net, 0)}
                </Text>
                <Text variant="caption">Net revenue</Text>
              </Card>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard value={d.fanCount} label="Fans" icon="community" />
              <StatCard value={d.boardCount} label="Boards" icon="kanban" />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard value={d.openTasks} label="Open tasks" icon="check" />
              <StatCard value={d.gigCount} label="Gigs" icon="flag" />
            </View>

            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text weight="semibold">Goal progress</Text>
                <Button title="Manage goals" size="sm" variant="link" onPress={() => router.push("/studio/goals" as Href)} />
              </View>
              {d.activeGoals.length === 0 ? (
                <View style={{ gap: 8 }}>
                  <Text variant="small">No active goals.</Text>
                  <Button title="Set one →" size="sm" variant="ghost" onPress={() => router.push("/studio/goals" as Href)} />
                </View>
              ) : (
                d.activeGoals.map((g) => (
                  <View key={g.id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ flex: 1 }} numberOfLines={2}>{g.title}</Text>
                      <Text variant="caption">{g.progress}%</Text>
                    </View>
                    <ProgressBar pct={g.progress} height={6} />
                  </View>
                ))
              )}
            </Card>

            <View style={{ gap: 12 }}>
              <LinkCard
                title="Revenue"
                detail={`${money(d.finance.income, 0)} in / ${money(d.finance.expense, 0)} out`}
                href="/studio/finance"
              />
              <LinkCard title="Fan CRM" detail={`${d.fanCount} fans`} href="/studio/fans" />
              <LinkCard title="Projects" detail={`${d.openTasks} open`} href="/boards" />
            </View>
          </>
        )}
      </QueryView>
    </Screen>
  );
}
