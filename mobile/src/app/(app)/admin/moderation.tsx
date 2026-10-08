// Moderation — the web's /admin/moderation: reported threads, posts and users.
// Data: GET /api/mobile/admin/moderation?status=open|dismissed|resolved|all.
// Actions: PATCH /api/admin/reports/:id { action } (moderator or admin).

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminList } from "@/components/admin/AdminList";
import { Quote, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, EmptyState, Pill, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import type { AdminModerationResponse } from "@/types/api";

const PATH = "/api/mobile/admin/moderation";
const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "dismissed", label: "Dismissed" },
  { key: "resolved", label: "Resolved" },
] as const;

type Report = AdminModerationResponse["reports"][number];

function ReportActions({ r }: { r: Report }) {
  const { run, busy } = useAdminAction([PATH]);
  const act = (action: "resolve" | "dismiss" | "delete_content", success: string) =>
    void run(`/api/admin/reports/${r.id}`, "PATCH", { action }, success);

  function removeContent() {
    const what =
      r.targetType === "user"
        ? "This suspends the reported user and resolves the report."
        : `This permanently deletes the reported ${r.targetType} and resolves the report.`;
    Alert.alert(r.targetType === "user" ? "Suspend user?" : "Remove content?", what, [
      { text: "Cancel", style: "cancel" },
      { text: r.targetType === "user" ? "Suspend" : "Remove", style: "destructive", onPress: () => act("delete_content", "Content removed") },
    ]);
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button title="Resolve" size="sm" onPress={() => act("resolve", "Report resolved")} loading={busy} />
      <Button title="Dismiss" size="sm" variant="ghost" onPress={() => act("dismiss", "Report dismissed")} disabled={busy} />
      <Button title={r.targetType === "user" ? "Suspend user" : "Remove content"} size="sm" variant="danger" onPress={removeContent} disabled={busy} />
    </View>
  );
}

function ReportCard({ r, canAct }: { r: Report; canAct: boolean }) {
  return (
    <Card style={{ gap: 12, marginBottom: 12 }}>
      <Text weight="semibold">Reason: {r.reason}</Text>
      <Quote>
        <Text variant="small" selectable>{r.preview}</Text>
      </Quote>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Chip label={r.targetType} />
        {r.status !== "open" ? <Chip label={r.status} tone={r.status === "resolved" ? "success" : "muted"} /> : null}
        <Text variant="caption">{new Date(r.createdAt).toLocaleString()}</Text>
      </View>
      {r.status === "open" && canAct ? <ReportActions r={r} /> : null}
    </Card>
  );
}

export default function Moderation() {
  const [status, setStatus] = useState<(typeof TABS)[number]["key"]>("open");
  const query = useApiQuery<AdminModerationResponse>(PATH, { status });
  const { role, can } = useStaffAccess();
  const canAct = can("moderator");

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Text variant="small">Reported threads, posts, and users.</Text>
      {!canAct ? <ViewOnlyNote role={role} needs="moderator or admin" /> : null}
      <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }} accessibilityRole="tablist">
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
        empty={<EmptyState icon="shield" title="Howdy! Nothing to see here." body="No reports match this filter." />}
      />
    </>
  );
}
