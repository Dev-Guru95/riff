// Goals & Milestones — the web's /studio/goals (GoalsClient.tsx).
// Data: GET /api/studio/goals; POST to add; PATCH/DELETE /api/studio/goals/[id].
// Milestone changes recompute progress (done / total) exactly like the web and
// are applied optimistically, then re-synced from the server on failure.

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { AddBar, CheckRow, IconButton, label, OptionPills, Sheet } from "@/components/studio/shared";
import { Button, Card, Chip, EmptyState, Field, PageHeader, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import { GOAL_STATUS, type GoalDTO, type GoalsResponse, type Milestone } from "@/types/studio";

const PATH = "/api/studio/goals";
const mPct = (ms: Milestone[]) => (ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : 0);

function EditGoal({ goal, onClose }: { goal: GoalDTO; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [status, setStatus] = useState(goal.status);
  const save = useApiMutation({ invalidates: [PATH, "/api/mobile/studio/dashboard"], success: "Goal saved", onSuccess: onClose });
  const remove = useApiMutation({ invalidates: [PATH, "/api/mobile/studio/dashboard"], success: "Goal deleted", onSuccess: onClose });
  const url = `${PATH}/${goal.id}`;

  return (
    <Sheet visible title="Edit goal" onClose={onClose} error={save.error ?? remove.error}>
      <Field label="Goal" value={title} onChangeText={setTitle} maxLength={200} />
      <OptionPills title="Status" options={GOAL_STATUS} value={status} onChange={setStatus} />
      <Button
        title="Save"
        fullWidth
        loading={save.isPending}
        disabled={!title.trim()}
        onPress={() => save.mutate({ path: url, method: "PATCH", body: { title: title.trim(), status } })}
      />
      <Button
        title="Delete goal"
        variant="danger"
        fullWidth
        loading={remove.isPending}
        onPress={() =>
          Alert.alert("Delete this goal?", goal.title, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate({ path: url, method: "DELETE" }) },
          ])
        }
      />
    </Sheet>
  );
}

export default function Goals() {
  const query = useApiQuery<GoalsResponse>(PATH);
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const add = useApiMutation({ invalidates: [PATH, "/api/mobile/studio/dashboard"], success: "Goal added" });
  const patch = useApiMutation();
  const [editing, setEditing] = useState<GoalDTO | null>(null);

  function setMilestones(g: GoalDTO, ms: Milestone[]) {
    const progress = mPct(ms);
    qc.setQueryData<GoalsResponse>([PATH], (old) =>
      old ? { goals: old.goals.map((x) => (x.id === g.id ? { ...x, milestones: ms, progress } : x)) } : old,
    );
    patch.mutate(
      { path: `${PATH}/${g.id}`, method: "PATCH", body: { milestones: ms, progress } },
      {
        onSuccess: () => void invalidate("/api/mobile/studio/dashboard"),
        onError: () => void invalidate(PATH),
      },
    );
  }

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Goals & Milestones" }} />
      <PageHeader title="🎯 Goals & Milestones" subtitle="Set career goals, break them into milestones, and watch the progress build." />
      <AddBar
        placeholder="New goal (e.g. Reach 10k monthly listeners)"
        maxLength={200}
        loading={add.isPending}
        onAdd={(title) => add.mutateAsync({ path: PATH, body: { title } })}
      />
      <QueryView
        query={query}
        isEmpty={(d) => d.goals.length === 0}
        empty={<EmptyState icon="target" title="No goals yet — add your first above." />}
      >
        {(d) => (
          <View style={{ gap: 12 }}>
            {d.goals.map((g) => (
              <Card key={g.id} style={{ gap: 10, opacity: g.status === "done" ? 0.7 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text weight="semibold" style={{ flex: 1 }}>{g.title}</Text>
                  <Chip label={label(g.status)} tone={g.status === "done" ? "success" : g.status === "archived" ? "muted" : "brand"} />
                  <IconButton icon="pencil" label={`Edit ${g.title}`} onPress={() => setEditing(g)} color={colors.foreground} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <ProgressBar pct={g.progress} />
                  </View>
                  <Text variant="caption" style={{ width: 40, textAlign: "right" }}>{g.progress}%</Text>
                </View>
                <View>
                  {g.milestones.map((m, i) => (
                    <CheckRow
                      key={i}
                      text={m.text}
                      checked={m.done}
                      onToggle={() => setMilestones(g, g.milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                      onRemove={() => setMilestones(g, g.milestones.filter((_, j) => j !== i))}
                    />
                  ))}
                </View>
                <AddBar
                  placeholder="+ Add milestone"
                  maxLength={200}
                  onAdd={(text) => setMilestones(g, [...g.milestones, { text, done: false }])}
                />
              </Card>
            ))}
          </View>
        )}
      </QueryView>
      {editing ? <EditGoal key={editing.id} goal={editing} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}
