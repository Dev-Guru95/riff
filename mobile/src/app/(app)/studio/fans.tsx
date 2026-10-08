// Fan CRM — the web's /studio/fans (FansClient.tsx).
// Data: GET /api/studio/fans?tag= (fans, segments, total); POST to add;
// PATCH (tags) / DELETE /api/studio/fans/[id].

import { useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { keepPreviousData } from "@tanstack/react-query";

import { Sheet, usePullRefresh } from "@/components/studio/shared";
import { Avatar, Button, Card, EmptyState, Field, Icon, PageHeader, Pill, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { FanDTO, FansResponse } from "@/types/studio";

const PATH = "/api/studio/fans";
const INVALIDATES = [PATH, "/api/mobile/studio/dashboard"];
const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

function AddFan({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");
  const add = useApiMutation({ invalidates: INVALIDATES, success: "Fan added", onSuccess: onClose });
  return (
    <Sheet visible title="Add a fan" onClose={onClose} error={add.error}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Name" maxLength={120} />
      <Field
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        placeholder="Email (optional)"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field label="Tags (comma-sep)" value={tags} onChangeText={setTags} placeholder="Tags (comma-sep)" autoCapitalize="none" />
      <Button
        title="Add"
        fullWidth
        loading={add.isPending}
        disabled={!name.trim()}
        onPress={() => add.mutate({ path: PATH, body: { name: name.trim(), email: email.trim(), tags: splitTags(tags) } })}
      />
    </Sheet>
  );
}

function EditFan({ fan, onClose }: { fan: FanDTO; onClose: () => void }) {
  const [tags, setTags] = useState(fan.tags.join(", "));
  const save = useApiMutation({ invalidates: INVALIDATES, success: "Tags saved", onSuccess: onClose });
  const remove = useApiMutation({ invalidates: INVALIDATES, success: "Fan removed", onSuccess: onClose });
  const url = `${PATH}/${fan.id}`;
  return (
    <Sheet visible title={fan.name} onClose={onClose} error={save.error ?? remove.error}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={fan.name} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" numberOfLines={1}>{fan.name}</Text>
          <Text variant="caption" numberOfLines={1}>{fan.email || "no email"}</Text>
        </View>
      </View>
      <Field label="Tags (comma-sep)" value={tags} onChangeText={setTags} placeholder="tags" autoCapitalize="none" />
      <Button
        title="Save tags"
        fullWidth
        loading={save.isPending}
        onPress={() => save.mutate({ path: url, method: "PATCH", body: { tags: splitTags(tags) } })}
      />
      <Button
        title={`Remove ${fan.name}`}
        variant="danger"
        fullWidth
        loading={remove.isPending}
        onPress={() =>
          Alert.alert("Remove this fan?", fan.name, [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => remove.mutate({ path: url, method: "DELETE" }) },
          ])
        }
      />
    </Sheet>
  );
}

export default function Fans() {
  const [filter, setFilter] = useState<string | null>(null);
  const query = useApiQuery<FansResponse>(PATH, filter ? { tag: filter } : undefined, { placeholderData: keepPreviousData });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FanDTO | null>(null);
  const pull = usePullRefresh(query.refetch);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: "Fan CRM" }} />
      <QueryView query={query}>
        {(d) => (
          <FlashList
            data={d.fans}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            refreshControl={
              <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
            }
            ListHeaderComponent={
              <View style={{ gap: 16, paddingBottom: 12 }}>
                <PageHeader title="Fan CRM" subtitle="Your audience in one place — tag fans into segments you can target." />
                <Button title="+ Add fan" fullWidth onPress={() => setAdding(true)} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <Pill label={`All (${d.total})`} active={!filter} onPress={() => setFilter(null)} />
                  {d.segments.map((sg) => (
                    <Pill key={sg.tag} label={`${sg.tag} (${sg.count})`} active={filter === sg.tag} onPress={() => setFilter(sg.tag)} />
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              <EmptyState icon="community" title={filter ? "No fans in this segment." : "No fans yet — add your first."} />
            }
            renderItem={({ item: f }) => (
              <Card onPress={() => setEditing(f)} accessibilityLabel={`${f.name}. Edit tags`} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                <Avatar name={f.name} size={34} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text weight="medium" numberOfLines={1}>{f.name}</Text>
                  <Text variant="caption" numberOfLines={1}>{f.email || "no email"}</Text>
                  {f.tags.length ? (
                    <Text variant="caption" color={colors.accent} numberOfLines={1}>{f.tags.join(", ")}</Text>
                  ) : null}
                </View>
                <Icon name="chevronRight" size={16} color={colors.muted} />
              </Card>
            )}
          />
        )}
      </QueryView>
      {adding ? <AddFan onClose={() => setAdding(false)} /> : null}
      {editing ? <EditFan key={editing.id} fan={editing} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}
