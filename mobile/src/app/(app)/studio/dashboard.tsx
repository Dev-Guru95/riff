// Career Dashboard — the web's /studio/dashboard (src/app/(app)/studio/dashboard/page.tsx).
// Data: GET /api/mobile/studio/dashboard (money in cents).

import { Pressable, View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { GoalBar, money } from "@/components/studio/shared";
import { Card, Icon, PageHeader, QueryView, Screen, StatCard, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { StudioDashboardResponse } from "@/types/api";

const go = (href: string) => router.push(href as Href);

/** `card px-4 py-3 text-sm`: "Revenue · $X in / $Y out". */
function LinkCard({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Card onPress={() => go(href)} accessibilityLabel={`${title}, ${detail}`} style={{ paddingVertical: 12 }}>
      <Text>
        <Text weight="medium">{title}</Text>
        <Text variant="small"> · {detail}</Text>
      </Text>
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
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard value={d.level.levelName} label={`${d.level.totalXp} XP`} icon="zap" />
                <StatCard value={`${d.streak.currentLen}d`} label={`Streak · best ${d.streak.longestLen}d`} icon="flame" />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard value={d.badgeCount} label="Badges" icon="award" />
                {/* StatCard with a coloured value (the web wraps the value in a tone span). */}
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
                  <Text variant="caption" numberOfLines={1}>Net revenue</Text>
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
            </View>

            <Card style={{ padding: 20, gap: 16, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text weight="semibold" accessibilityRole="header">Goal progress</Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => go("/studio/goals")}
                  hitSlop={12}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Text variant="caption" color={colors.accent}>Manage goals</Text>
                  <Icon name="chevronRight" size={12} color={colors.accent} />
                </Pressable>
              </View>
              {d.activeGoals.length === 0 ? (
                <Text variant="small">
                  No active goals.{" "}
                  <Text variant="small" color={colors.accent} accessibilityRole="link" onPress={() => go("/studio/goals")} suppressHighlighting>
                    Set one →
                  </Text>
                </Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {d.activeGoals.slice(0, 5).map((g) => (
                    <GoalBar key={g.id} label={g.title} pct={g.progress} />
                  ))}
                </View>
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
