// Goals & Milestones — the web's /studio/goals (GoalsClient.tsx).
// Data: GET /api/studio/goals; POST to add; PATCH/DELETE /api/studio/goals/[id].
// Edits apply optimistically and re-sync from the server on failure (as the web).
// Milestone changes recompute progress (done / total) exactly like the web.

import { useState } from "react";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router";

import { AddRow, CommitInput, Input, RemoveButton, Select, useStudioWrite } from "@/components/studio/shared";
import { Card, Icon, PageHeader, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import { GOAL_STATUS, type GoalDTO, type GoalsResponse, type Milestone } from "@/types/studio";

const PATH = "/api/studio/goals";
const ALSO = ["/api/mobile/studio/dashboard"];
const mPct = (ms: Milestone[]) => (ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : 0);
// The web's <option>s are the raw lowercase values.
const STATUS_OPTIONS = GOAL_STATUS.map((s) => ({ value: s, label: s }));

/** `<input placeholder="+ Add milestone + Enter">`: adds on Enter and clears. */
function MilestoneInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Input
      value={value}
      onChangeText={setValue}
      placeholder="+ Add milestone + Enter"
      maxLength={200}
      returnKeyType="done"
      submitBehavior="submit"
      onSubmitEditing={() => {
        const v = value.trim();
        if (!v) return;
        setValue("");
        onAdd(v);
      }}
      accessibilityLabel="Add milestone"
      style={{ marginTop: 4 }}
    />
  );
}

function MilestoneRow({ m, onToggle, onRemove }: { m: Milestone; onToggle: () => void; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: m.done }}
        accessibilityLabel={m.text}
        onPress={onToggle}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 }}
      >
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: radius.sm - 1,
            borderWidth: 1,
            borderColor: m.done ? colors.brand : colors.muted,
            backgroundColor: m.done ? colors.brand : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {m.done ? <Icon name="check" size={12} color={colors.white} strokeWidth={2.4} /> : null}
        </View>
        <Text style={[{ flex: 1 }, m.done && { textDecorationLine: "line-through", color: colors.muted }]}>{m.text}</Text>
      </Pressable>
      <RemoveButton label={`Remove ${m.text}`} onPress={onRemove} size={12} />
    </View>
  );
}

export default function Goals() {
  const query = useApiQuery<GoalsResponse>(PATH);
  const write = useStudioWrite<GoalsResponse>([PATH], ALSO);

  const add = (title: string) => void write(PATH, "POST", { title }, undefined, { reload: true });
  const patch = (id: string, d: Partial<GoalDTO>) =>
    void write(`${PATH}/${id}`, "PATCH", d, (old) => ({ goals: old.goals.map((g) => (g.id === id ? { ...g, ...d } : g)) }));
  const del = (id: string) => void write(`${PATH}/${id}`, "DELETE", undefined, (old) => ({ goals: old.goals.filter((g) => g.id !== id) }));
  const setMilestones = (g: GoalDTO, ms: Milestone[]) => patch(g.id, { milestones: ms, progress: mPct(ms) });

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Goals & Milestones" }} />
      <PageHeader title="🎯 Goals & Milestones" subtitle="Set career goals, break them into milestones, and watch the progress build." />
      <AddRow placeholder="New goal (e.g. Reach 10k monthly listeners)" maxLength={200} onAdd={add} />
      <QueryView query={query}>
        {(d) => (
          <View style={{ gap: 12 }}>
            {d.goals.map((g) => (
              <Card key={g.id} style={{ opacity: g.status === "done" ? 0.7 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CommitInput
                    key={`t:${g.title}`}
                    initial={g.title}
                    weight="semibold"
                    maxLength={200}
                    accessibilityLabel="Goal title"
                    style={{ flex: 1 }}
                    onCommit={(v) => v.trim() && patch(g.id, { title: v.trim() })}
                  />
                  <Select accessibilityLabel="Status" options={STATUS_OPTIONS} value={g.status} onChange={(status) => patch(g.id, { status })} />
                  <RemoveButton label={`Delete ${g.title}`} onPress={() => del(g.id)} />
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 4 }}>
                  <View style={{ flex: 1 }}>
                    <ProgressBar pct={g.progress} />
                  </View>
                  <Text variant="caption" style={{ width: 40, textAlign: "right" }}>{g.progress}%</Text>
                </View>

                <View style={{ marginTop: 8, gap: 2 }}>
                  {g.milestones.map((m, i) => (
                    <MilestoneRow
                      key={i}
                      m={m}
                      onToggle={() => setMilestones(g, g.milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                      onRemove={() => setMilestones(g, g.milestones.filter((_, j) => j !== i))}
                    />
                  ))}
                  {g.milestones.length < 50 ? (
                    <MilestoneInput onAdd={(text) => setMilestones(g, [...g.milestones, { text, done: false }])} />
                  ) : null}
                </View>
              </Card>
            ))}
            {d.goals.length === 0 ? (
              <Text variant="small" style={{ textAlign: "center", paddingVertical: 24 }}>No goals yet — add your first above.</Text>
            ) : null}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
