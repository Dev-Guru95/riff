// AI builder (Artist Bio, Editorial Pitch, …) — the web's /studio/[kind]
// (src/app/(app)/studio/[kind]/AiBuilder.tsx). Write a draft, get a Riff Score
// with structured feedback, revise.
// Data: GET /api/mobile/studio/[kind]; writes via /api/studio/drafts*.
// Static siblings (dashboard, bookings, …) win over this dynamic segment in
// Expo Router, and no builder kind collides with them.

import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { get } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Input } from "@/components/studio/shared";
import { Button, Card, PageHeader, ProgressRing, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { ReviewResult, StudioBuilderResponse, StudioDraft } from "@/types/api";
import type { CreatedResponse, DraftResponse } from "@/types/studio";

function FbList({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text weight="medium" color={tone} style={{ marginBottom: 2 }}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 6 }}>
          <Text variant="small">•</Text>
          <Text variant="small" style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Feedback({ fb, scoredAt }: { fb: ReviewResult; scoredAt: string | null }) {
  return (
    <Card style={{ padding: 20, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 }}>
        <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          <ProgressRing pct={fb.score} size={64} />
          <Text weight="bold" style={{ position: "absolute" }}>{fb.score}</Text>
        </View>
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
  const toast = useToast();

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; content: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "score" | "new">("");
  const [titleFocused, setTitleFocused] = useState(false);

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

  // Like the web, switching drafts drops unsaved edits to the current one.
  function select(d: StudioDraft) {
    setChosenId(d.id);
    setEdit(null);
  }

  function change(next: Partial<{ title: string; content: string }>) {
    if (!active) return;
    setEdit({ id: active.id, title, content, ...next });
  }

  async function newDraft() {
    if (!kind) return;
    setBusy("new");
    let created = false;
    try {
      const { id } = await create.mutateAsync({ path: "/api/studio/drafts", body: { kind, title: "Untitled" } });
      created = true;
      const fresh = await get<DraftResponse>(`/api/studio/drafts/${id}`);
      putDraft(fresh.draft);
      setChosenId(fresh.draft.id);
      setEdit(null);
    } catch (e) {
      // A failed create is toasted by the mutation; a failed re-read is not.
      if (created) {
        toast(errorMessage(e), "error");
        void qc.invalidateQueries({ queryKey: [path] });
      }
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

            <View style={{ gap: 4 }}>
              {drafts.map((d) => {
                const on = d.id === active?.id;
                return (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${d.title || "Untitled"}${d.score != null ? `, score ${d.score}` : ""}`}
                    onPress={() => select(d)}
                    style={({ pressed }) => [s.draftRow, (on || pressed) && { backgroundColor: colors.surface2 }]}
                  >
                    <Text style={{ flex: 1 }} numberOfLines={1}>{d.title || "Untitled"}</Text>
                    {d.score != null ? <Text variant="caption" color={colors.accent}>{d.score}</Text> : null}
                  </Pressable>
                );
              })}
              {drafts.length === 0 ? <Text variant="caption" style={{ paddingHorizontal: 4 }}>No drafts yet — create one.</Text> : null}
            </View>

            {active ? (
              <>
                <TextInput
                  value={title}
                  onChangeText={(t) => change({ title: t })}
                  placeholder="Draft title"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.brand}
                  maxLength={120}
                  onFocus={() => setTitleFocused(true)}
                  onBlur={() => setTitleFocused(false)}
                  style={[s.titleInput, titleFocused && { borderBottomColor: colors.brand }]}
                  accessibilityLabel="Draft title"
                />
                <Text variant="caption">{builder.instructions}</Text>
                <Input
                  look="field"
                  value={content}
                  onChangeText={(t) => change({ content: t })}
                  placeholder={builder.placeholder}
                  multiline
                  maxLength={20000}
                  style={{ minHeight: 216, borderRadius: radius.md, fontSize: 14, lineHeight: 20 }}
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
                  <Button
                    title="Delete"
                    variant="danger"
                    onPress={() => del(active.id)}
                    style={{ marginLeft: "auto", borderColor: colors.border }}
                  />
                </View>

                <Text variant="caption">
                  <Text variant="caption" weight="medium" color={colors.foreground}>Scored on: </Text>
                  {builder.rubric.map((r) => `${r.criterion} (${r.weight}%)`).join(" · ")}
                </Text>

                {active.feedback ? <Feedback fb={active.feedback} scoredAt={active.scoredAt} /> : null}
              </>
            ) : (
              <Card style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ fontSize: 36, lineHeight: 44, marginBottom: 8 }}>{builder.icon}</Text>
                <Text weight="semibold">Start your first draft</Text>
                <Text variant="small" style={{ marginTop: 4, textAlign: "center" }}>Write it, get a Riff Score, then revise to improve.</Text>
              </Card>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const s = StyleSheet.create({
  draftRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH, paddingHorizontal: 12, borderRadius: radius.md },
  titleInput: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: fonts.semibold,
    color: colors.foreground,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
});
