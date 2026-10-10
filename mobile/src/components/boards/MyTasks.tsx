// The web /boards Dashboard (src/app/(app)/boards/Dashboard.tsx) at phone
// width: four stat cards (2×2), the Due today / Overdue / Upcoming (7 days)
// lists, Project progress, Team workload and Recently active.
// Data: GET /api/mobile/boards/dashboard (loadDashboard → DashboardDTO).

import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { Avatar, Card, ProgressBar, StatCard, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, TOUCH } from "@/theme/tokens";
import type { DashboardDTO, TaskLite } from "@/types/boards";
import { fmtDate, labelColor, relTime } from "./utils";

export const MY_TASKS_PATH = "/api/mobile/boards/dashboard";

function TaskRow({ t, overdue }: { t: TaskLite; overdue?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/boards/${t.boardId}?card=${t.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${t.title} on ${t.boardTitle}`}
      style={({ pressed }) => [styles.taskRow, pressed && { backgroundColor: colors.surface2 }]}
    >
      <Text style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>{t.title}</Text>
      <Text variant="caption" numberOfLines={1} style={{ maxWidth: 96 }}>{t.boardTitle}</Text>
      {t.dueDate ? (
        <Text variant="caption" color={overdue ? colors.brand2 : undefined} weight={overdue ? "medium" : undefined}>
          {fmtDate(t.dueDate)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function List({ title, tasks, empty, overdue }: { title: string; tasks: TaskLite[]; empty: string; overdue?: boolean }) {
  return (
    <Card>
      <View style={styles.cardHead}>
        <Text weight="semibold">{title}</Text>
        <Text variant="caption">{tasks.length}</Text>
      </View>
      {tasks.length === 0 ? (
        <Text variant="caption" style={{ paddingHorizontal: 8, paddingVertical: 4 }}>{empty}</Text>
      ) : (
        tasks.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} overdue={overdue} />)
      )}
    </Card>
  );
}

export function Dashboard() {
  const { data } = useApiQuery<DashboardDTO>(MY_TASKS_PATH);
  // Secondary panel: stays out of the way while loading or on error; the board
  // list below has its own error state. Same visibility rule as the web.
  if (!data) return null;
  const hasAnything = data.openCount || data.completedCount || data.boardProgress.length || data.recentBoards.length;
  if (!hasAnything) return null;

  return (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <View style={styles.grid}>
        <View style={styles.half}><StatCard value={data.openCount} label="Open tasks" icon="kanban" /></View>
        <View style={styles.half}><StatCard value={data.overdue.length} label="Overdue" icon="flame" /></View>
        <View style={styles.half}><StatCard value={data.dueToday.length} label="Due today" icon="calendar" /></View>
        <View style={styles.half}><StatCard value={data.completedCount} label="Completed" icon="check" /></View>
      </View>

      <List title="Due today" tasks={data.dueToday} empty="Nothing due today." />
      <List title="Overdue" tasks={data.overdue} overdue empty="No overdue tasks. 🎉" />
      <List title="Upcoming (7 days)" tasks={data.upcoming} empty="No deadlines this week." />

      <Card>
        <Text weight="semibold" style={{ marginBottom: 12 }}>Project progress</Text>
        {data.boardProgress.length === 0 ? (
          <Text variant="caption">No boards yet.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {data.boardProgress.slice(0, 6).map((b) => {
              const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => router.push(`/boards/${b.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.title}, ${b.done} of ${b.total} done`}
                  style={({ pressed }) => [{ gap: 4 }, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.progressHead}>
                    <View style={[styles.dot, { backgroundColor: labelColor(b.color) }]} />
                    <Text style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>{b.title}</Text>
                    <Text variant="caption">{b.done}/{b.total} · {pct}%</Text>
                  </View>
                  <ProgressBar pct={pct} />
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <Text weight="semibold" style={{ marginBottom: 8 }}>Team workload</Text>
        {data.workload.length === 0 ? (
          <Text variant="caption">No open assignments.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {data.workload.map((w) => (
              <View key={w.userId} style={styles.progressHead}>
                <Avatar name={w.name} size={24} />
                <Text style={{ flex: 1 }} numberOfLines={1}>{w.name}</Text>
                <Text variant="caption">{w.open} open</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text weight="semibold" style={{ marginBottom: 8 }}>Recently active</Text>
        {data.recentBoards.length === 0 ? (
          <Text variant="caption">No recent activity.</Text>
        ) : (
          data.recentBoards.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/boards/${b.id}` as Href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.taskRow, pressed && { backgroundColor: colors.surface2 }]}
            >
              <View style={[styles.dot, { backgroundColor: labelColor(b.color) }]} />
              <Text style={{ flex: 1 }} numberOfLines={1}>{b.title}</Text>
              <Text variant="caption">{relTime(b.when)}</Text>
            </Pressable>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  half: { width: "47%", flexGrow: 1, flexDirection: "row" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH, paddingHorizontal: 8, borderRadius: 8 },
  progressHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
