// Broadcasts — the web's /studio/broadcasts (BroadcastsClient.tsx). The web's
// two columns stack at phone width: the broadcast list, then the composer.
// Data: GET /api/studio/broadcasts; POST { subject } to create;
// PATCH/DELETE /api/studio/broadcasts/[id]; POST /api/studio/broadcasts/[id]/send
// (records the send and audience size — no email provider is connected).

import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Stack } from "expo-router";

import { MarkdownEditor } from "@/components/studio/MarkdownEditor";
import { AddRow, Input, useStudioWrite } from "@/components/studio/shared";
import { Button, Card, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius, tint, TOUCH } from "@/theme/tokens";
import type { BroadcastDTO, BroadcastsResponse, CreatedResponse, SendBroadcastResponse } from "@/types/studio";

const PATH = "/api/studio/broadcasts";
type Draft = { id: string; subject: string; body: string; segment: string };

function Composer({ items }: { items: BroadcastDTO[] }) {
  const write = useStudioWrite<BroadcastsResponse>([PATH]);
  const invalidate = useInvalidate();
  // undefined = not chosen yet → the first unsent broadcast, as the web opens with.
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveId = activeId === undefined ? (items.find((b) => !b.sentAt)?.id ?? null) : activeId;
  const active = items.find((b) => b.id === effectiveId) ?? null;
  const cur: Draft | null = active ? (edit && edit.id === active.id ? edit : { id: active.id, subject: active.subject, body: active.body, segment: active.segment }) : null;
  const sent = !!active?.sentAt;
  const dirty = !!active && !!cur && !sent && (cur.subject !== active.subject || cur.body !== active.body || cur.segment !== active.segment);
  const change = (patch: Partial<Draft>) => cur && setEdit({ ...cur, ...patch });
  const payload = (d: Draft) => ({ subject: d.subject, body: d.body, segment: d.segment });

  async function select(b: BroadcastDTO) {
    // Auto-save the current draft's edits before switching so they aren't lost.
    if (dirty && cur) await write(`${PATH}/${cur.id}`, "PATCH", payload(cur), undefined, { reload: true });
    setActiveId(b.id);
    setEdit(null);
  }

  async function create(subject: string) {
    const res = await write<CreatedResponse>(PATH, "POST", { subject }, undefined, { reload: true });
    if (res?.id) {
      if (dirty && cur) await write(`${PATH}/${cur.id}`, "PATCH", payload(cur), undefined, { reload: true });
      setActiveId(res.id);
      setEdit(null);
    }
  }

  async function save() {
    if (!cur || busy) return;
    setBusy(true);
    const ok = await write(`${PATH}/${cur.id}`, "PATCH", payload(cur), undefined, { reload: true });
    if (ok !== undefined) setEdit(null);
    setBusy(false);
  }

  async function send() {
    if (!cur || busy) return;
    setBusy(true);
    const saved = await write(`${PATH}/${cur.id}`, "PATCH", payload(cur));
    const res = saved === undefined ? undefined : await write<SendBroadcastResponse>(`${PATH}/${cur.id}/send`, "POST");
    if (res) {
      Alert.alert(
        "Recorded",
        `Recorded — this broadcast targets ${res.recipientCount} fan(s) with an email. (Connect an email provider to actually deliver.)`,
      );
      await invalidate(PATH);
      setEdit(null);
    }
    setBusy(false);
  }

  function del(id: string) {
    if (id === effectiveId) {
      setActiveId(null);
      setEdit(null);
    }
    void write(`${PATH}/${id}`, "DELETE", undefined, (old) => ({ broadcasts: old.broadcasts.filter((b) => b.id !== id) }));
  }

  return (
    <>
      <View>
        <View style={{ marginBottom: 12 }}>
          <AddRow placeholder="New broadcast" buttonTitle="+" maxLength={160} onAdd={(s) => void create(s)} />
        </View>
        <View style={{ gap: 4 }}>
          {items.map((b) => {
            const on = b.id === effectiveId;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${b.subject}, ${b.sentAt ? `sent to ${b.recipientCount}` : "draft"}`}
                onPress={() => void select(b)}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH, paddingHorizontal: 12, borderRadius: radius.md },
                  (on || pressed) && { backgroundColor: colors.surface2 },
                ]}
              >
                <Text style={{ flex: 1 }} numberOfLines={1}>{b.subject}</Text>
                {b.sentAt ? (
                  <Text style={{ fontSize: 10, lineHeight: 14 }} color={colors.success}>sent · {b.recipientCount}</Text>
                ) : (
                  <Text style={{ fontSize: 10, lineHeight: 14 }} color={colors.muted}>draft</Text>
                )}
              </Pressable>
            );
          })}
          {items.length === 0 ? <Text variant="caption" style={{ paddingHorizontal: 4 }}>No broadcasts yet.</Text> : null}
        </View>
      </View>

      {active && cur ? (
        <View style={{ gap: 8 }}>
          <Input
            value={cur.subject}
            editable={!sent}
            onChangeText={(t) => change({ subject: t })}
            maxLength={160}
            large
            weight="semibold"
            accessibilityLabel="Subject"
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="caption" style={{ flexShrink: 1 }}>Segment (fan tag, blank = all)</Text>
            <Input
              value={cur.segment}
              editable={!sent}
              onChangeText={(t) => change({ segment: t })}
              placeholder="all fans"
              autoCapitalize="none"
              maxLength={30}
              accessibilityLabel="Segment (fan tag, blank = all)"
              style={{ flex: 1 }}
            />
          </View>
          <MarkdownEditor value={cur.body} onChange={(t) => change({ body: t })} disabled={sent} placeholder="Write your update…" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {sent ? (
              <Text color={colors.success} style={{ flexShrink: 1 }}>
                Sent to {active.recipientCount} fan(s) · {new Date(active.sentAt!).toLocaleDateString()}
              </Text>
            ) : (
              <>
                <Button title="Send" disabled={busy} onPress={() => void send()} />
                <Button title="Save draft" variant="ghost" disabled={busy} onPress={() => void save()} />
              </>
            )}
            <Button
              title="Delete"
              variant="danger"
              onPress={() => del(active.id)}
              style={{ marginLeft: "auto", borderColor: colors.border }}
            />
          </View>
        </View>
      ) : (
        <Card style={{ padding: 40, alignItems: "center" }}>
          <Text variant="small">Select or create a broadcast.</Text>
        </Card>
      )}
    </>
  );
}

export default function Broadcasts() {
  const query = useApiQuery<BroadcastsResponse>(PATH);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Broadcasts" }} />
      <PageHeader title="📣 Broadcasts" subtitle="Compose updates for your fans and target them by segment." />
      <View style={{ padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: tint(colors.warning, 0.05), marginTop: -12 }}>
        <Text variant="caption" color={colors.warning}>
          ⚠️ Email delivery is not connected yet. Sending records the broadcast and its audience size; hook up an email provider to actually
          deliver (mirrors how billing/social degrade until keys are set).
        </Text>
      </View>
      <QueryView query={query}>{(d) => <Composer items={d.broadcasts} />}</QueryView>
    </Screen>
  );
}
