// The web /boards "my work" panel: open/done counts, overdue / due today /
// upcoming assigned cards. Data: GET /api/mobile/boards/dashboard (loadDashboard).

import { View } from "react-native";
import { router, type Href } from "expo-router";

import { Card, StatCard, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { DashboardDTO, TaskLite } from "@/types/boards";

export const MY_TASKS_PATH = "/api/mobile/boards/dashboard";

function TaskGroup({ title, tasks, color }: { title: string; tasks: TaskLite[]; color: string }) {
  if (tasks.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold" color={color}>
        {title} · {tasks.length}
      </Text>
      {tasks.slice(0, 5).map((t) => (
        <Card
          key={t.id}
          onPress={() => router.push(`/boards/${t.boardId}?card=${t.id}` as Href)}
          accessibilityLabel={`${t.title} on ${t.boardTitle}`}
          style={{ paddingVertical: 10, gap: 2 }}
        >
          <Text weight="medium" numberOfLines={1}>{t.title}</Text>
          <Text variant="caption" numberOfLines={1}>
            {t.boardTitle}
            {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export function MyTasks() {
  const { data } = useApiQuery<DashboardDTO>(MY_TASKS_PATH);
  // Secondary panel: stays out of the way while loading or on error; the board
  // list below has its own error state.
  if (!data || data.openCount + data.completedCount === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="label" accessibilityRole="header">My work</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard icon="inbox" value={data.openCount} label="Open tasks" />
        <StatCard icon="check" value={data.completedCount} label="Completed" />
      </View>
      <TaskGroup title="Overdue" tasks={data.overdue} color={colors.danger} />
      <TaskGroup title="Due today" tasks={data.dueToday} color={colors.warning} />
      <TaskGroup title="Upcoming" tasks={data.upcoming} color={colors.accent} />
    </View>
  );
}
