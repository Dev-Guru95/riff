// Fan CRM — the web's /studio/fans (FansClient.tsx).
// Data: GET /api/studio/fans?tag= (fans, segments, total); POST to add;
// PATCH (tags, saved on blur) / DELETE /api/studio/fans/[id]. Like the web,
// every write re-loads the list (segment counts come from the server).

import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { keepPreviousData } from "@tanstack/react-query";

import { CommitInput, Input, KeyboardScroll, RemoveButton, splitTags, SquareAvatar, StudioEmpty, useStudioWrite } from "@/components/studio/shared";
import { Button, Card, PageHeader, Pill, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { FansResponse } from "@/types/studio";

const PATH = "/api/studio/fans";
const ALSO = ["/api/mobile/studio/dashboard"];

/** The web's add form (`card p-4 grid gap-2`), one column at phone width. */
function AddFanForm({ onAdd }: { onAdd: (body: { name: string; email: string; tags: string[] }) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd({ name: name.trim(), email: email.trim(), tags: splitTags(tags) });
    setBusy(false);
    if (ok) {
      setName("");
      setEmail("");
      setTags("");
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <Input look="field" value={name} onChangeText={setName} placeholder="Name" maxLength={120} accessibilityLabel="Name" />
      <Input
        look="field"
        value={email}
        onChangeText={setEmail}
        placeholder="Email (optional)"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Email (optional)"
      />
      <Input
        look="field"
        value={tags}
        onChangeText={setTags}
        placeholder="Tags (comma-sep)"
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        accessibilityLabel="Tags (comma-sep)"
      />
      <Button title="Add" fullWidth disabled={busy} onPress={() => void submit()} />
    </Card>
  );
}

export default function Fans() {
  const [filter, setFilter] = useState<string | null>(null);
  const tagQuery = filter ? { tag: filter } : undefined;
  const query = useApiQuery<FansResponse>(PATH, tagQuery, { placeholderData: keepPreviousData });
  const write = useStudioWrite<FansResponse>(tagQuery ? [PATH, tagQuery] : [PATH], ALSO);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const add = async (body: { name: string; email: string; tags: string[] }) =>
    (await write(PATH, "POST", body, undefined, { reload: true })) !== undefined;
  const patchTags = (id: string, tagStr: string) => void write(`${PATH}/${id}`, "PATCH", { tags: splitTags(tagStr) }, undefined, { reload: true });
  const del = (id: string) =>
    void write(`${PATH}/${id}`, "DELETE", undefined, (old) => ({ ...old, fans: old.fans.filter((f) => f.id !== id) }), { reload: true });

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: "Fan CRM" }} />
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.fans}
            keyExtractor={(f) => f.id}
            renderScrollComponent={KeyboardScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
            }
            ListHeaderComponent={
              <View style={{ gap: 16, paddingBottom: 16 }}>
                <PageHeader title="Fan CRM" subtitle="Your audience in one place — tag fans into segments you can target." />
                <AddFanForm onAdd={add} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }} accessibilityRole="tablist">
                  <Pill label={`All (${d.total})`} active={!filter} onPress={() => setFilter(null)} />
                  {d.segments.map((sg) => (
                    <Pill key={sg.tag} label={`${sg.tag} (${sg.count})`} active={filter === sg.tag} onPress={() => setFilter(sg.tag)} />
                  ))}
                </View>
              </View>
            }
            ListEmptyComponent={<StudioEmpty icon="community" title={filter ? "No fans in this segment." : "No fans yet — add your first."} />}
            renderItem={({ item: f }) => (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                <SquareAvatar name={f.name} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium" numberOfLines={1}>{f.name}</Text>
                  <Text variant="caption" numberOfLines={1}>{f.email || "no email"}</Text>
                </View>
                <CommitInput
                  key={`${f.id}:${f.tags.join(",")}`}
                  look="field"
                  initial={f.tags.join(", ")}
                  placeholder="tags"
                  autoCapitalize="none"
                  accessibilityLabel={`Tags for ${f.name}`}
                  style={{ width: 140 }}
                  onCommit={(v) => patchTags(f.id, v)}
                />
                <RemoveButton label={`Remove ${f.name}`} onPress={() => del(f.id)} />
              </Card>
            )}
          />
        )}
      </QueryView>
    </Screen>
  );
}
