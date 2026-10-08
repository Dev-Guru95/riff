// AI builder (Artist Bio, Editorial Pitch, …) — the web's /studio/[kind]
// (src/app/(app)/studio/[kind]/AiBuilder.tsx). Write a draft, get a Riff Score
// with structured feedback, revise.
// Data: GET /api/mobile/studio/[kind]; writes via /api/studio/drafts*.
// Static siblings (dashboard, bookings, …) win over this dynamic segment in
// Expo Router, and no builder kind collides with them.

import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { get } from "@/api/client";
import { Button, Card, EmptyState, Field, PageHeader, ProgressRing, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { ReviewResult, StudioBuilderResponse, StudioDraft } from "@/types/api";
import type { CreatedResponse, DraftResponse } from "@/types/studio";

function FbList({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text weight="medium" color={tone}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <Text variant="small">•</Text>
          <Text variant="small" style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Feedback({ fb, scoredAt }: { fb: ReviewResult; scoredAt: string | null }) {
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ProgressRing pct={fb.score} label={`${fb.score}`} />
        <View style={{ flex: 1 }}>
          <Text weight="bold">Your Riff Score</Text>
          <Text variant="caption">
            {scoredAt ? `Scored ${new Date(scoredAt).toLocaleString()}` : ""}
            {fb.confidence < 0.6 ? " · low confidence — consider human review" : ""}
          </Text>
        </View>
      </View>
      <FbList title="✅ Strengths" items={fb.strengths} tone={colors.success} />
      <FbList title="⚠️ Weaknesses" items={fb.weaknesses} tone={colors.warning} />
      <FbList title="🛠️ Recommendations" items={fb.recommendations} />
      <FbList title="➡️ Next actions" items={fb.nextActions} tone={colors.accent} />
    </Card>
  );
}

export default function BuilderScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const path = `/api/mobile/studio/${encodeURIComponent(kind ?? "")}`;
  const query = useApiQuery<StudioBuilderResponse>(kind ? path : null);
  const qc = useQueryClient();

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; content: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "score" | "new">("");

  const create = useApiMutation<CreatedResponse>();
  const write = useApiMutation<DraftResponse>();
  const remove = useApiMutation({ invalidates: [path], success: "Draft deleted" });

  const drafts = query.data?.drafts ?? [];
  const active = drafts.find((d) => d.id === chosenId) ?? drafts[0] ?? null;
  const editing = edit && active && edit.id === active.id ? edit : null;
  const title = editing?.title ?? active?.title ?? "";
  const content = editing?.content ?? active?.content ?? "";
  const dirty = !!editing && !!active && (editing.title !== active.title || editing.content !== active.content);

  /** Put a draft returned by the API into the cached list so the screen updates at once. */
  function putDraft(d: StudioDraft) {
    qc.setQueryData<StudioBuilderResponse>([path], (old) =>
      old ? { ...old, drafts: old.drafts.some((x) => x.id === d.id) ? old.drafts.map((x) => (x.id === d.id ? d : x)) : [d, ...old.drafts] } : old,
    );
  }

  function select(d: StudioDraft) {
    const go = () => {
      setChosenId(d.id);
      setEdit(null);
    };
    if (dirty && d.id !== active?.id) {
      Alert.alert("Discard changes?", "This draft has unsaved edits.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: go },
      ]);
    } else go();
  }

  function change(next: Partial<{ title: string; content: string }>) {
    if (!active) return;
    setEdit({ id: active.id, title, content, ...next });
  }

  async function newDraft() {
    if (!kind) return;
    setBusy("new");
    try {
      const { id } = await create.mutateAsync({ path: "/api/studio/drafts", body: { kind, title: "Untitled" } });
      const fresh = await get<DraftResponse>(`/api/studio/drafts/${id}`);
      putDraft(fresh.draft);
      setChosenId(fresh.draft.id);
      setEdit(null);
    } catch {
      // toasted by the mutation
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!active) return;
    setBusy("save");
    try {
      const { draft } = await write.mutateAsync({
        path: `/api/studio/drafts/${active.id}`,
        method: "PATCH",
        body: { title: title.trim() || "Untitled", content },
      });
      putDraft(draft);
      setEdit(null);
    } catch {
      // toasted
    } finally {
      setBusy("");
    }
  }

  async function score() {
    if (!active) return;
    setBusy("score");
    try {
      // Persist the latest edits first, then score — as the web does.
      await write.mutateAsync({ path: `/api/studio/drafts/${active.id}`, method: "PATCH", body: { title: title.trim() || "Untitled", content } });
      const { draft } = await write.mutateAsync({ path: `/api/studio/drafts/${active.id}/score`, method: "POST" });
      putDraft(draft);
      setEdit(null);
    } catch {
      // toasted
    } finally {
      setBusy("");
    }
  }

  function del(id: string) {
    Alert.alert("Delete this draft?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          remove.mutate(
            { path: `/api/studio/drafts/${id}`, method: "DELETE" },
            {
              onSuccess: () => {
                if (id === active?.id) {
                  setChosenId(null);
                  setEdit(null);
                }
              },
            },
          );
        },
      },
    ]);
  }

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: query.data?.builder.name ?? "Studio" }} />
      <QueryView query={query}>
        {({ builder }) => (
          <>
            <PageHeader title={`${builder.icon} ${builder.name}`} subtitle={builder.tagline} />

            <Button title="+ New draft" fullWidth onPress={() => void newDraft()} loading={busy === "new"} disabled={busy !== ""} />

            {drafts.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {drafts.map((d) => {
                  const on = d.id === active?.id;
                  return (
                    <Pressable
                      key={d.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${d.title || "Untitled"}${d.score != null ? `, score ${d.score}` : ""}`}
                      onPress={() => select(d)}
                      style={[s.draftChip, on && s.draftChipOn]}
                    >
                      <Text weight={on ? "semibold" : "regular"} numberOfLines={1} style={{ maxWidth: 180 }}>
                        {d.title || "Untitled"}
                      </Text>
                      {d.score != null ? <Text variant="caption" color={colors.accent}>{d.score}</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text variant="caption">No drafts yet — create one.</Text>
            )}

            {active ? (
              <>
                <Field
                  value={title}
                  onChangeText={(t) => change({ title: t })}
                  placeholder="Draft title"
                  maxLength={120}
                  style={{ fontSize: 18, fontFamily: fonts.semibold }}
                  accessibilityLabel="Draft title"
                />
                <Text variant="caption">{builder.instructions}</Text>
                <Field
                  value={content}
                  onChangeText={(t) => change({ content: t })}
                  placeholder={builder.placeholder}
                  multiline
                  maxLength={20000}
                  style={{ minHeight: 220 }}
                  accessibilityLabel="Draft content"
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Button
                    title={busy === "score" ? "Scoring…" : "Get Riff Score"}
                    onPress={() => void score()}
                    loading={busy === "score"}
                    disabled={busy !== "" || !content.trim()}
                  />
                  <Button
                    title={busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
                    variant="ghost"
                    onPress={() => void save()}
                    disabled={busy !== "" || !dirty}
                  />
                  <Button title="Delete" variant="danger" onPress={() => del(active.id)} style={{ marginLeft: "auto" }} />
                </View>

                <Text variant="caption">
                  <Text variant="caption" weight="medium" color={colors.foreground}>Scored on: </Text>
                  {builder.rubric.map((r) => `${r.criterion} (${r.weight}%)`).join(" · ")}
                </Text>

                {active.feedback ? <Feedback fb={active.feedback} scoredAt={active.scoredAt} /> : null}
              </>
            ) : (
              <Card>
                <EmptyState
                  icon="pencil"
                  title={`${builder.icon} Start your first draft`}
                  body="Write it, get a Riff Score, then revise to improve."
                />
              </Card>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const s = StyleSheet.create({
  draftChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TOUCH,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  draftChipOn: { backgroundColor: colors.surface2, borderColor: colors.brand },
});
