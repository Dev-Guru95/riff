// Review Queue — the web's /admin/submissions: low-confidence AI reviews are
// flagged for a human to confirm or override. Data:
// GET /api/mobile/admin/submissions?status=flagged|reviewed|all (latest 50).
// Override: PATCH /api/admin/submissions/:id { aiScore, status, note? }
// (reviewer or admin; the server awards XP on a confirmed pass).

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminList } from "@/components/admin/AdminList";
import { NumberField, Quote, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, EmptyState, Field, Pill, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors } from "@/theme/tokens";
import type { AdminSubmissionsResponse } from "@/types/api";

const PATH = "/api/mobile/admin/submissions";
const TABS = [
  { key: "all", label: "All" },
  { key: "reviewed", label: "Reviewed" },
  { key: "flagged", label: "Flagged" },
] as const;

type Submission = AdminSubmissionsResponse["submissions"][number];

function OverrideForm({ s }: { s: Submission }) {
  const { run, busy } = useAdminAction([PATH, "/api/mobile/admin/overview"]);
  const [score, setScore] = useState(s.aiScore ?? 70);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(s.humanReviewed);
  const passMark = s.assignment.minPassingScore;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  async function submit(status: "reviewed" | "resubmit") {
    const res = await run(
      `/api/admin/submissions/${s.id}`,
      "PATCH",
      { aiScore: clamp(score), status, ...(note.trim() ? { note: note.trim() } : {}) },
      status === "reviewed" ? (score >= passMark ? "Approved — pass recorded" : "Approved below the pass mark") : "Resubmission requested",
    );
    if (res) setDone(true);
  }

  if (done) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text variant="caption" color={colors.success}>✓ Human-reviewed</Text>
        <Button title="Review again" variant="link" size="sm" onPress={() => setDone(false)} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Button title="−5" variant="ghost" size="sm" onPress={() => setScore((v) => clamp(v - 5))} accessibilityLabel="Lower score by 5" />
        <View style={{ flex: 1 }}>
          <NumberField label={`Score (pass mark ${passMark})`} value={score} onChange={(n) => setScore(clamp(n))} />
        </View>
        <Button title="+5" variant="ghost" size="sm" onPress={() => setScore((v) => clamp(v + 5))} accessibilityLabel="Raise score by 5" />
      </View>
      <Field placeholder="Note for the audit log (optional)" value={note} onChangeText={setNote} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          title={`Approve ${score >= passMark ? "(pass + XP)" : "(below pass)"}`}
          size="sm"
          onPress={() => void submit("reviewed")}
          loading={busy}
        />
        <Button
          title="Request resubmit"
          size="sm"
          variant="ghost"
          disabled={busy}
          onPress={() =>
            Alert.alert("Request a resubmission?", `${s.user.email} will be asked to submit this assignment again.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Request", onPress: () => void submit("resubmit") },
            ])
          }
        />
      </View>
    </View>
  );
}

function SubmissionCard({ s, canReview }: { s: Submission; canReview: boolean }) {
  return (
    <Card style={{ gap: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium">{s.assignment.title}</Text>
          <Text variant="caption" numberOfLines={1}>{s.user.email} · {new Date(s.createdAt).toLocaleDateString()}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 24, lineHeight: 30 }} weight="bold">{s.aiScore ?? "—"}</Text>
          <Text variant="caption">conf {s.confidence != null ? Math.round(s.confidence * 100) : "—"}%</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Chip label={s.status} tone={s.status === "flagged" ? "warning" : s.status === "reviewed" ? "success" : "muted"} />
        <Chip label={s.artifactType} />
        {s.humanReviewed ? <Chip label="Human-reviewed" tone="success" icon="check" /> : null}
      </View>
      {s.textContent || s.externalLink || s.artifactUrls.length ? (
        <Quote>
          {s.textContent ? <Text selectable>{s.textContent}</Text> : null}
          {s.externalLink ? (
            <Text variant="caption" color={colors.accent} onPress={() => void openLink(s.externalLink!)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
              {s.externalLink}
            </Text>
          ) : null}
          {s.artifactUrls.map((u, i) => (
            <Text key={u} variant="caption" color={colors.accent} onPress={() => void openLink(u)} accessibilityRole="link" style={{ paddingVertical: 4 }}>
              Attachment {i + 1} ›
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
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Text variant="small">Low confidence AI reviews are flagged here for a human to confirm or override</Text>
      {!canReview ? <ViewOnlyNote role={role} needs="reviewer or admin" /> : null}
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="tablist">
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
        empty={<EmptyState icon="clipboard" title="Howdy! Nothing to see here." body="No submissions match this filter." />}
      />
    </>
  );
}
