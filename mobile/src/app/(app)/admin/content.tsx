// AI Content Suggestions — the web's /admin/content (page.tsx + ContentClient.tsx).
// Data: GET /api/mobile/admin/content (latest 50, split into pending / resolved).
// Decision (admin only): PATCH /api/admin/content-suggestions/:id { decision }.

import { View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { Tag, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, PageHeader, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors, fonts } from "@/theme/tokens";
import type { AdminContentResponse } from "@/types/api";

const PATH = "/api/mobile/admin/content";

/** The web's `text-sm font-semibold text-muted uppercase tracking-wide` section heading. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

function ContentDecision({ id }: { id: string }) {
  const toast = useToast();
  // Approving bumps the course version, so the course list is refreshed too.
  const { call, busy } = useAdminCall([PATH, "/api/mobile/admin/overview", "/api/mobile/admin/courses"]);
  async function decide(decision: "approved" | "rejected") {
    const res = await call(`/api/admin/content-suggestions/${id}`, "PATCH", { decision });
    if (!res.ok && res.error) toast(res.error, "error");
  }
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Button title="Approve" size="sm" onPress={() => void decide("approved")} disabled={busy} />
      <Button title="Reject" size="sm" variant="ghost" onPress={() => void decide("rejected")} disabled={busy} />
    </View>
  );
}

export default function AdminContent() {
  const query = useApiQuery<AdminContentResponse>(PATH);
  const { role, can } = useStaffAccess();
  const canDecide = can("admin");

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 24 }}>
      <Stack.Screen options={{ title: "AI Content" }} />
      <View style={{ marginBottom: -8 }}>
        <PageHeader
          title="AI Content Suggestions"
          subtitle="AI proposes content updates from industry trends. Approve to apply (bumps course version), or reject."
        />
      </View>
      {!canDecide ? <ViewOnlyNote role={role} needs="admin" /> : null}

      <QueryView query={query}>
        {(d) => (
          <>
            <View style={{ gap: 12 }}>
              <SectionHeading>Pending ({d.pending.length})</SectionHeading>
              {d.pending.map((s) => (
                <Card key={s.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <Tag label={s.targetType} />
                    <Text weight="medium" style={{ flexShrink: 1 }}>{s.title}</Text>
                  </View>
                  <Text variant="small" style={{ marginBottom: 8 }}>{s.rationale}</Text>
                  {s.sourceUrls.map((u) => (
                    <Text key={u} variant="caption" color={colors.accent} onPress={() => void openLink(u)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
                      {u}
                    </Text>
                  ))}
                  {canDecide ? (
                    <View style={{ marginTop: 12 }}>
                      <ContentDecision id={s.id} />
                    </View>
                  ) : null}
                </Card>
              ))}
              {d.pending.length === 0 ? <Text variant="small">No pending suggestions.</Text> : null}
            </View>

            {d.resolved.length > 0 ? (
              <View style={{ gap: 8 }}>
                <SectionHeading>Resolved</SectionHeading>
                {d.resolved.map((s) => (
                  <Card key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 12 }}>
                    <Text style={{ flex: 1 }}>{s.title}</Text>
                    <Text color={s.status === "approved" ? colors.success : colors.danger}>{s.status}</Text>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
