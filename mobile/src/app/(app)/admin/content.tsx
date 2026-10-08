// AI Content Suggestions — the web's /admin/content. Data: GET /api/mobile/admin/content
// (latest 50, split into pending / resolved). Decision (admin only):
// PATCH /api/admin/content-suggestions/:id { decision: approved | rejected }.

import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { ViewOnlyNote } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, QueryView, Screen, Section, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors } from "@/theme/tokens";
import type { AdminContentResponse, AdminContentSuggestion } from "@/types/api";

const PATH = "/api/mobile/admin/content";

function Decision({ s }: { s: AdminContentSuggestion }) {
  const { run, busy } = useAdminAction([PATH, "/api/mobile/admin/overview", "/api/mobile/admin/courses"]);
  const decide = (decision: "approved" | "rejected") =>
    void run(`/api/admin/content-suggestions/${s.id}`, "PATCH", { decision }, decision === "approved" ? "Suggestion approved" : "Suggestion rejected");

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Button title="Approve" size="sm" onPress={() => decide("approved")} loading={busy} />
      <Button
        title="Reject"
        size="sm"
        variant="ghost"
        disabled={busy}
        onPress={() =>
          Alert.alert("Reject suggestion?", `"${s.title}" will be marked rejected.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Reject", style: "destructive", onPress: () => decide("rejected") },
          ])
        }
      />
    </View>
  );
}

export default function AdminContent() {
  const query = useApiQuery<AdminContentResponse>(PATH);
  const { role, can } = useStaffAccess();
  const canDecide = can("admin");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "AI Content" }} />
      <Text variant="small">AI proposes content updates from industry trends. Approve to apply (bumps course version), or reject.</Text>
      {!canDecide ? <ViewOnlyNote role={role} needs="admin" /> : null}

      <QueryView query={query}>
        {(d) => (
          <>
            <Section title={`Pending (${d.pending.length})`}>
              {d.pending.map((s) => (
                <Card key={s.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Chip label={s.targetType} />
                    <Text weight="medium" style={{ flexShrink: 1 }}>{s.title}</Text>
                  </View>
                  <Text variant="small">{s.rationale}</Text>
                  {s.sourceUrls.map((u) => (
                    <Text key={u} variant="caption" color={colors.accent} onPress={() => void openLink(u)} accessibilityRole="link" numberOfLines={1} style={{ paddingVertical: 4 }}>
                      {u}
                    </Text>
                  ))}
                  {canDecide ? <Decision s={s} /> : null}
                </Card>
              ))}
              {d.pending.length === 0 ? <Text variant="small">No pending suggestions.</Text> : null}
            </Section>

            {d.resolved.length > 0 ? (
              <Section title="Resolved">
                {d.resolved.map((s) => (
                  <Card key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
                    <Text style={{ flex: 1 }}>{s.title}</Text>
                    <Text variant="caption" color={s.status === "approved" ? colors.success : colors.danger}>{s.status}</Text>
                  </Card>
                ))}
              </Section>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
