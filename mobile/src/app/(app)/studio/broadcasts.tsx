// Broadcasts — the web's /studio/broadcasts (BroadcastsClient.tsx).
// Data: GET /api/studio/broadcasts; POST { subject } to create;
// PATCH/DELETE /api/studio/broadcasts/[id]; POST /api/studio/broadcasts/[id]/send
// (records the send and audience size — no email provider is connected).

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { AddBar, Sheet } from "@/components/studio/shared";
import { Markdown } from "@/components/Markdown";
import { Button, Card, Chip, EmptyState, Field, PageHeader, Pill, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, tint } from "@/theme/tokens";
import type { BroadcastDTO, BroadcastsResponse, CreatedResponse, SendBroadcastResponse } from "@/types/studio";

const PATH = "/api/studio/broadcasts";

function Composer({ item, onClose }: { item: BroadcastDTO; onClose: () => void }) {
  const sent = !!item.sentAt;
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [segment, setSegment] = useState(item.segment);
  const [preview, setPreview] = useState(sent);
  const dirty = !sent && (subject !== item.subject || body !== item.body || segment !== item.segment);
  const url = `${PATH}/${item.id}`;

  const save = useApiMutation({ invalidates: [PATH] });
  const send = useApiMutation<SendBroadcastResponse>({ invalidates: [PATH] });
  const remove = useApiMutation({ invalidates: [PATH], success: "Broadcast deleted", onSuccess: onClose });
  const busy = save.isPending || send.isPending || remove.isPending;
  const payload = { subject: subject.trim() || item.subject, body, segment: segment.trim() };

  // Like the web, unsaved edits are saved when you leave the draft.
  async function close() {
    if (dirty) {
      try {
        await save.mutateAsync({ path: url, method: "PATCH", body: payload });
      } catch {
        return; // keep the sheet open; the error shows inline
      }
    }
    onClose();
  }

  async function doSend() {
    try {
      await save.mutateAsync({ path: url, method: "PATCH", body: payload });
      const { recipientCount } = await send.mutateAsync({ path: `${url}/send`, method: "POST" });
      Alert.alert(
        "Recorded",
        `Recorded — this broadcast targets ${recipientCount} fan(s) with an email. (Connect an email provider to actually deliver.)`,
      );
      onClose();
    } catch {
      // shown inline
    }
  }

  return (
    <Sheet visible title={sent ? "Sent broadcast" : "Edit broadcast"} onClose={() => void close()} error={save.error ?? send.error ?? remove.error}>
      <Field label="Subject" value={subject} onChangeText={setSubject} editable={!sent} maxLength={160} style={sent ? { opacity: 0.7 } : undefined} />
      <Field
        label="Segment (fan tag, blank = all)"
        value={segment}
        onChangeText={setSegment}
        editable={!sent}
        placeholder="all fans"
        autoCapitalize="none"
        maxLength={30}
        style={sent ? { opacity: 0.7 } : undefined}
      />
      {!sent ? (
        <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="tablist">
          <Pill label="Write" active={!preview} onPress={() => setPreview(false)} />
          <Pill label="Preview" active={preview} onPress={() => setPreview(true)} />
        </View>
      ) : null}
      {preview ? (
        <Card>{body.trim() ? <Markdown>{body}</Markdown> : <Text variant="small">Nothing to preview.</Text>}</Card>
      ) : (
        <Field value={body} onChangeText={setBody} multiline placeholder="Write your update…" maxLength={20000} style={{ minHeight: 200 }} accessibilityLabel="Message body" />
      )}

      {sent ? (
        <Text color={colors.success}>
          Sent to {item.recipientCount} fan(s) · {new Date(item.sentAt!).toLocaleDateString()}
        </Text>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title="Send"
            loading={send.isPending}
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() =>
              Alert.alert("Send this broadcast?", segment.trim() ? `To fans tagged “${segment.trim()}”.` : "To all fans.", [
                { text: "Cancel", style: "cancel" },
                { text: "Send", onPress: () => void doSend() },
              ])
            }
          />
          <Button
            title="Save draft"
            variant="ghost"
            loading={save.isPending && !send.isPending}
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() => save.mutate({ path: url, method: "PATCH", body: payload }, { onSuccess: onClose })}
          />
        </View>
      )}
      <Button
        title="Delete"
        variant="danger"
        fullWidth
        disabled={busy}
        onPress={() =>
          Alert.alert("Delete this broadcast?", item.subject, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate({ path: url, method: "DELETE" }) },
          ])
        }
      />
    </Sheet>
  );
}

export default function Broadcasts() {
  const query = useApiQuery<BroadcastsResponse>(PATH);
  const create = useApiMutation<CreatedResponse>({ invalidates: [PATH] });
  const [active, setActive] = useState<BroadcastDTO | null>(null);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Broadcasts" }} />
      <PageHeader title="📣 Broadcasts" subtitle="Compose updates for your fans and target them by segment." />
      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tint(colors.warning), backgroundColor: tint(colors.warning, 0.05) }}>
        <Text variant="caption" color={colors.warning}>
          ⚠️ Email delivery is not connected yet. Sending records the broadcast and its audience size; hook up an email provider to actually
          deliver (mirrors how billing/social degrade until keys are set).
        </Text>
      </View>

      <AddBar
        placeholder="New broadcast"
        maxLength={160}
        buttonTitle="+"
        loading={create.isPending}
        onAdd={async (subject) => {
          const { id } = await create.mutateAsync({ path: PATH, body: { subject } });
          setActive({ id, subject, body: "", segment: "", recipientCount: 0, sentAt: null });
        }}
      />

      <QueryView
        query={query}
        isEmpty={(d) => d.broadcasts.length === 0}
        empty={<EmptyState icon="inbox" title="No broadcasts yet." body="Select or create a broadcast." />}
      >
        {(d) => (
          <View style={{ gap: 8 }}>
            {d.broadcasts.map((b) => (
              <Card
                key={b.id}
                onPress={() => setActive(b)}
                accessibilityLabel={`${b.subject}, ${b.sentAt ? `sent to ${b.recipientCount}` : "draft"}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text weight="medium" style={{ flex: 1 }} numberOfLines={2}>{b.subject}</Text>
                {b.sentAt ? <Chip label={`sent · ${b.recipientCount}`} tone="success" /> : <Chip label="draft" />}
              </Card>
            ))}
          </View>
        )}
      </QueryView>

      {active ? <Composer key={active.id} item={active} onClose={() => setActive(null)} /> : null}
    </Screen>
  );
}
