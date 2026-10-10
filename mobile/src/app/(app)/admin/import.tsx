// Import Course — the web's /admin/import (ImportClient.tsx): 1 · Upload a .docx
// or .pdf → POST /api/admin/import/parse (multipart `file`, ≤15 MB, no DB write);
// 2 · Review & edit every module, lesson, question and assignment with live
// validation; 3 · Done → POST /api/admin/import { course, sourceFile }.
// Admin only (server-checked).

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, type Href } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { upload } from "@/api/client";
import { ApiError, errorMessage, isOfflineError } from "@/api/errors";
import { useStaffAccess } from "@/components/admin/access";
import { CardTitle, ViewOnlyNote } from "@/components/admin/controls";
import { COURSES_PATH } from "@/components/admin/CourseEditor";
import { PreviewStep, type ParseMeta } from "@/components/admin/ImportEditor";
import { clone, type ImportDone, type ParseResponse, type ParsedCourse } from "@/components/admin/importModel";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Screen, Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";

type Step = "upload" | "preview" | "done";

const MAX_BYTES = 15 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function Stepper({ step }: { step: Step }) {
  const steps: [Step, string][] = [
    ["upload", "1 · Upload"],
    ["preview", "2 · Review & edit"],
    ["done", "3 · Done"],
  ];
  const idx = steps.findIndex(([s]) => s === step);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {steps.map(([s, label], i) => (
        <View key={s} style={[styles.step, { borderColor: i <= idx ? colors.brand : colors.border }]} accessibilityState={{ selected: s === step }}>
          <Text variant="caption" color={i <= idx ? colors.brand : colors.muted}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function UploadStep({ busy, onPick }: { busy: boolean; onPick: () => void }) {
  return (
    <Card style={styles.drop}>
      <Text style={{ fontSize: 36, lineHeight: 44, marginBottom: 12 }}>📄</Text>
      <Text weight="semibold" style={{ marginBottom: 4, textAlign: "center" }}>{busy ? "Reading & extracting…" : "Choose a .docx or .pdf"}</Text>
      <Text variant="caption" style={{ marginBottom: 20, textAlign: "center" }}>
        Modules, lessons, quizzes, true/false and short-answer questions are detected automatically.
      </Text>
      <Button title={busy ? "Working…" : "Choose file"} onPress={onPick} disabled={busy} style={{ alignSelf: "center" }} />
      <Text variant="caption" style={{ marginTop: 16, textAlign: "center" }}>
        Legacy .doc isn&apos;t supported — save it as .docx first. Max 15 MB.
      </Text>
    </Card>
  );
}

function DoneStep({ done, onAnother }: { done: ImportDone; onAnother: () => void }) {
  return (
    <Card style={{ padding: 28, gap: 16, alignItems: "center" }}>
      <Text style={{ fontSize: 36, lineHeight: 44 }}>✅</Text>
      <View style={{ gap: 4 }}>
        <CardTitle size={16} style={{ fontSize: 18, lineHeight: 28, textAlign: "center" }}>Imported “{done.title}”</CardTitle>
        <Text variant="small" style={{ textAlign: "center" }}>
          {done.counts.modules} modules · {done.counts.lessons} lessons · {done.counts.questions} questions · {done.counts.assignments} assignments. Created as
          a draft — review and publish it from Courses.
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
        <Button title="Open course" onPress={() => router.push(`/admin/courses/${done.id}` as Href)} />
        <Button title="Import another" variant="ghost" onPress={onAnother} />
      </View>
    </Card>
  );
}

export default function ImportCourse() {
  const { role, can } = useStaffAccess();
  const { call, busy: importing } = useAdminCall([COURSES_PATH, "/api/mobile/admin/overview"]);
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [course, setCourse] = useState<ParsedCourse | null>(null);
  const [meta, setMeta] = useState<ParseMeta | null>(null);
  const [done, setDone] = useState<ImportDone | null>(null);
  const busy = parsing || importing;

  function mutate(fn: (c: ParsedCourse) => void) {
    setCourse((prev) => {
      if (!prev) return prev;
      const c = clone(prev);
      fn(c);
      return c;
    });
  }

  async function onPick() {
    setErr(null);
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({ type: [DOCX, "application/pdf"], copyToCacheDirectory: true });
    } catch {
      return setErr("Couldn't open the file picker.");
    }
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file) return;
    if (file.size && file.size > MAX_BYTES) return setErr("File too large (max 15 MB).");
    const isPdf = /\.pdf$/i.test(file.name) || file.mimeType === "application/pdf";
    setParsing(true);
    try {
      const data = await upload<ParseResponse>("/api/admin/import/parse", {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType ?? (isPdf ? "application/pdf" : DOCX),
      });
      setCourse(data.course);
      setMeta({ method: data.method, format: data.format, truncated: data.truncated, sourceFile: data.sourceFile });
      setStep("preview");
    } catch (e) {
      setErr(
        isOfflineError(e)
          ? "Upload failed. Check your connection and try again."
          : e instanceof ApiError && typeof e.body?.error === "string"
            ? e.body.error
            : e instanceof ApiError && e.kind !== "server"
              ? errorMessage(e)
              : "Failed to parse the document.",
      );
    } finally {
      setParsing(false);
    }
  }

  async function onImport() {
    if (!course) return;
    setErr(null);
    const res = await call<ImportDone>("/api/admin/import", "POST", { course, sourceFile: meta?.sourceFile ?? "" });
    if (res.ok) {
      setDone(res.data);
      setStep("done");
    } else if (res.error) {
      const issues = res.body?.issues;
      setErr(Array.isArray(issues) ? issues.join(" · ") : res.error || "Import failed.");
    }
  }

  function reset() {
    setCourse(null);
    setMeta(null);
    setDone(null);
    setErr(null);
    setStep("upload");
  }

  return (
    <Screen contentStyle={{ gap: 24 }}>
      <Stack.Screen options={{ title: "Import Course" }} />
      <View style={{ gap: 4 }}>
        <Text variant="title" accessibilityRole="header">Import Course</Text>
        <Text variant="small">
          Upload a Word (.docx) or PDF file. The system extracts the course, modules, lessons, quizzes and questions for you to review before
          saving.
        </Text>
      </View>

      {!can("admin") ? (
        <ViewOnlyNote role={role} needs="admin" />
      ) : (
        <>
          <Stepper step={step} />

          {err ? (
            <Card style={{ borderColor: colors.danger }}>
              <Text color={colors.danger} accessibilityLiveRegion="polite">{err}</Text>
            </Card>
          ) : null}

          {step === "upload" ? <UploadStep busy={busy} onPick={onPick} /> : null}

          {step === "preview" && course && meta ? (
            <PreviewStep course={course} meta={meta} busy={busy} mutate={mutate} onCancel={reset} onImport={onImport} />
          ) : null}

          {step === "done" && done ? <DoneStep done={done} onAnother={reset} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  drop: { padding: 40, alignItems: "center", borderWidth: 2, borderStyle: "dashed", borderColor: colors.border },
});
