// Review Queue — the web's /admin/submissions (page.tsx + ReviewClient.tsx):
// low-confidence AI reviews are flagged for a human to confirm or override.
// Data: GET /api/mobile/admin/submissions?status=flagged|reviewed|all (latest 50).
// Override: PATCH /api/admin/submissions/:id { aiScore, status } (reviewer or
// admin; the server awards XP on a confirmed pass).

import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminList } from "@/components/admin/AdminList";
import { AdminEmpty, Quote, Slider, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, PageHeader, Pill, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors, fonts } from "@/theme/tokens";
import type { AdminSubmissionsResponse } from "@/types/api";

const PATH = "/api/mobile/admin/submissions";
const TABS = [
  { key: "all", label: "All" },
  { key: "reviewed", label: "Reviewed" },
  { key: "flagged", label: "Flagged" },
] as const;

type Submission = AdminSubmissionsResponse["submissions"][number];

/** Web OverrideForm: Score slider (0–100), Approve (pass + XP | below pass), Request resubmit. */
function OverrideForm({ s }: { s: Submission }) {
  const toast = useToast();
  const { call, busy } = useAdminCall([PATH, "/api/mobile/admin/overview"]);
  const [score, setScore] = useState(s.aiScore ?? 70);
  const [done, setDone] = useState(s.humanReviewed);
  const passMark = s.assignment.minPassingScore;

  async function submit(decision: "reviewed" | "resubmit") {
    const res = await call(`/api/admin/submissions/${s.id}`, "PATCH", { aiScore: score, status: decision });
    if (res.ok) setDone(true);
    else if (res.error) toast(res.error, "error");
  }

  if (done) return <Text variant="caption" color={colors.success}>✓ Human-reviewed</Text>;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="caption">Score</Text>
        <Slider value={score} min={0} max={100} onChange={setScore} accessibilityLabel="Score" />
        <Text style={{ width: 32, fontFamily: fonts.bold, color: colors.foreground }}>{String(score)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button title={`Approve ${score >= passMark ? "(pass + XP)" : "(below pass)"}`} size="sm" onPress={() => void submit("reviewed")} disabled={busy} />
        <Button title="Request resubmit" size="sm" variant="ghost" onPress={() => void submit("resubmit")} disabled={busy} />
      </View>
    </View>
  );
}

function SubmissionCard({ s, canReview }: { s: Submission; canReview: boolean }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium">{s.assignment.title}</Text>
          <Text variant="caption">
            {s.user.email} · {new Date(s.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 24, lineHeight: 32, fontFamily: fonts.bold, color: colors.foreground }}>{s.aiScore != null ? String(s.aiScore) : "—"}</Text>
          <Text variant="caption">
            conf {s.confidence != null ? Math.round(s.confidence * 100) : "—"}% · {s.status}
          </Text>
        </View>
      </View>
      {s.textContent || s.externalLink || s.artifactUrls.length ? (
        <Quote style={{ marginBottom: 12 }}>
          {s.textContent ? <Text selectable>{s.textContent}</Text> : null}
          {s.externalLink ? (
            <Text variant="caption" color={colors.accent} onPress={() => void openLink(s.externalLink!)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
              {s.externalLink}
            </Text>
          ) : null}
          {s.artifactUrls.map((u, i) => (
            <Text key={u} variant="caption" color={colors.accent} onPress={() => void openLink(u)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
              Attachment {i + 1}
            </Text>
          ))}
        </Quote>
      ) : null}
      {canReview ? <OverrideForm s={s} /> : s.humanReviewed ? <Text variant="caption" color={colors.success}>✓ Human-reviewed</Text> : null}
    </Card>
  );
}

export default function ReviewQueue() {
  const [status, setStatus] = useState<(typeof TABS)[number]["key"]>("flagged");
  const query = useApiQuery<AdminSubmissionsResponse>(PATH, { status });
  const { role, can } = useStaffAccess();
  const canReview = can("reviewer");

  const header = (
    <View style={{ paddingBottom: 20 }}>
      <PageHeader title="Review Queue" subtitle="Low confidence AI reviews are flagged here for a human to confirm or override" />
      {!canReview ? (
        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <ViewOnlyNote role={role} needs="reviewer or admin" />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 4, marginTop: 16 }} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pill key={t.key} label={t.label} active={status === t.key} onPress={() => setStatus(t.key)} />
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: "Review Queue" }} />
      <AdminList
        query={query}
        select={(d) => d.submissions}
        keyOf={(s) => s.id}
        extraData={canReview}
        renderItem={(s) => <SubmissionCard key={s.id} s={s} canReview={canReview} />}
        header={header}
        empty={<AdminEmpty title="Howdy! Nothing to see here." hint="No submissions match this filter." />}
      />
    </>
  );
}
