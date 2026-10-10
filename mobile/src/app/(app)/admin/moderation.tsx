// Moderation — the web's /admin/moderation (page.tsx + ModerationClient.tsx):
// reported threads, posts and users. Data:
// GET /api/mobile/admin/moderation?status=open|dismissed|resolved|all (latest 100).
// Actions: PATCH /api/admin/reports/:id { action } (moderator or admin).

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminList } from "@/components/admin/AdminList";
import { AdminEmpty, Quote, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, PageHeader, Pill, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { AdminModerationResponse } from "@/types/api";

const PATH = "/api/mobile/admin/moderation";
const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "dismissed", label: "Dismissed" },
  { key: "resolved", label: "Resolved" },
] as const;

type Report = AdminModerationResponse["reports"][number];

/** Web ReportActions: Resolve (primary), Dismiss (muted text), Remove content (pink text). */
function ReportActions({ id }: { id: string }) {
  const toast = useToast();
  const { call, busy } = useAdminCall([PATH]);
  async function act(action: "resolve" | "dismiss" | "delete_content") {
    const res = await call(`/api/admin/reports/${id}`, "PATCH", { action });
    if (!res.ok && res.error) toast(res.error, "error");
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Button title="Resolve" size="sm" onPress={() => void act("resolve")} disabled={busy} />
      <Text
        variant="caption"
        weight="semibold"
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        style={{ paddingVertical: 10, opacity: busy ? 0.5 : 1 }}
        onPress={() => void act("dismiss")}
      >
        Dismiss
      </Text>
      <Text
        variant="caption"
        weight="semibold"
        color={colors.danger}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        style={{ paddingVertical: 10, opacity: busy ? 0.5 : 1 }}
        onPress={() =>
          // Destructive: deletes the post/thread (or suspends the user) — confirm first.
          Alert.alert("Remove content?", "This removes the reported content and resolves the report.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove content", style: "destructive", onPress: () => void act("delete_content") },
          ])
        }
      >
        Remove content
      </Text>
    </View>
  );
}

function ReportCard({ r, canAct }: { r: Report; canAct: boolean }) {
  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <Text weight="semibold" style={{ marginBottom: 12 }}>Reason: {r.reason}</Text>
      <Quote style={{ marginBottom: 16, paddingVertical: 10 }}>
        <Text variant="small" selectable>{r.preview}</Text>
      </Quote>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        {r.status === "open" ? (
          canAct ? <ReportActions id={r.id} /> : <Text variant="caption" style={{ textTransform: "capitalize" }}>{r.status}</Text>
        ) : (
          <Text variant="caption" style={{ textTransform: "capitalize" }}>{r.status}</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Chip label={r.targetType} />
          <Text variant="caption">{new Date(r.createdAt).toLocaleString()}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function Moderation() {
  const [status, setStatus] = useState<(typeof TABS)[number]["key"]>("open");
  const query = useApiQuery<AdminModerationResponse>(PATH, { status });
  const { role, can } = useStaffAccess();
  const canAct = can("moderator");

  const header = (
    <View style={{ paddingBottom: 20 }}>
      <PageHeader title="Moderation" subtitle="Reported threads, posts, and users." />
      {!canAct ? (
        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <ViewOnlyNote role={role} needs="moderator or admin" />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 16 }} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pill key={t.key} label={t.label} active={status === t.key} onPress={() => setStatus(t.key)} />
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: "Moderation" }} />
      <AdminList
        query={query}
        select={(d) => d.reports}
        keyOf={(r) => r.id}
        extraData={canAct}
        renderItem={(r) => <ReportCard key={r.id} r={r} canAct={canAct} />}
        header={header}
        empty={<AdminEmpty title="Howdy! Nothing to see here." hint="No reports match this filter." />}
      />
    </>
  );
}
