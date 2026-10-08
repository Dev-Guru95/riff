// Course import — a mobile take on the web's /admin/import (ImportClient.tsx):
// pick a .docx/.pdf → POST /api/admin/import/parse (multipart `file`, ≤15 MB,
// no DB write) → review the extracted outline → POST /api/admin/import
// { course, sourceFile }. Admin only (server-checked).
//
// The web lets you edit every module, lesson and question before importing.
// On a phone we keep the review to the course title, description and level;
// the full outline can be edited afterwards in the course editor.

import { useState } from "react";
import { View } from "react-native";
import { router, Stack, type Href } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { upload } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useStaffAccess } from "@/components/admin/access";
import { Label, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { COURSES_PATH } from "@/components/admin/CourseEditor";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, Divider, Field, Screen, Text, useToast } from "@/components/ui";
import { colors } from "@/theme/tokens";

const MAX_BYTES = 15 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Level = "beginner" | "intermediate" | "advanced";
const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// Subset of src/lib/import/types.ts ParsedCourse we read; the rest is passed
// back to the server untouched.
type ParsedCourse = {
  title: string;
  description: string;
  level: Level;
  objectives: string[];
  durationText: string;
  modules: { title: string; lessons: { title: string; questions: unknown[]; assignment: unknown | null }[] }[];
  [k: string]: unknown;
};
type ParseResult = {
  course: ParsedCourse;
  method: "ai" | "heuristic";
  format: string;
  truncated: boolean;
  sourceFile: string;
  errors: string[];
  warnings: string[];
};
type ImportResult = { id: string; slug: string; title: string; counts: { modules: number; lessons: number; questions: number; assignments: number } };

export default function ImportCourse() {
  const toast = useToast();
  const { role, can } = useStaffAccess();
  const { run, busy: importing } = useAdminAction([COURSES_PATH, "/api/mobile/admin/overview"]);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [course, setCourse] = useState<ParsedCourse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick() {
    setErr(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: [DOCX, "application/pdf"], copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file) return;
    if (file.size && file.size > MAX_BYTES) return setErr("File too large (max 15 MB).");
    const isPdf = /\.pdf$/i.test(file.name) || file.mimeType === "application/pdf";
    setParsing(true);
    try {
      const res = await upload<ParseResult>("/api/admin/import/parse", {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType ?? (isPdf ? "application/pdf" : DOCX),
      });
      setParsed(res);
      setCourse(res.course);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setParsing(false);
    }
  }

  async function doImport() {
    if (!course || !parsed) return;
    if (!course.title.trim()) return toast("The course needs a title.", "error");
    const res = await run<ImportResult>("/api/admin/import", "POST", { course: { ...course, title: course.title.trim() }, sourceFile: parsed.sourceFile }, "Course imported as a draft");
    if (res?.id) router.replace(`/admin/courses/${res.id}` as Href);
  }

  if (!can("admin")) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Import course" }} />
        <ViewOnlyNote role={role} needs="admin" />
      </Screen>
    );
  }

  const lessons = course?.modules.reduce((n, m) => n + m.lessons.length, 0) ?? 0;
  const questions = course?.modules.reduce((n, m) => n + m.lessons.reduce((k, l) => k + (l.questions?.length ?? 0), 0), 0) ?? 0;
  const blocked = (parsed?.errors.length ?? 0) > 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Import course" }} />
      <Text variant="small">Upload a Word (.docx) or PDF course outline. Riff extracts modules, lessons and quizzes for you to review before anything is saved.</Text>

      <Card style={{ gap: 10 }}>
        <Button title={parsed ? "Choose a different file" : "Choose .docx or .pdf"} icon="download" variant={parsed ? "ghost" : "primary"} onPress={pick} loading={parsing} fullWidth />
        {parsing ? <Text variant="caption">Reading the document… this can take up to a minute.</Text> : null}
        {err ? <Text variant="caption" color={colors.danger}>{err}</Text> : null}
      </Card>

      {parsed && course ? (
        <>
          <Card style={{ gap: 12 }}>
            <Label right={<Chip label={parsed.method === "ai" ? "AI parsed" : "Heuristic"} tone="accent" />}>{parsed.sourceFile}</Label>
            {parsed.truncated ? <Text variant="caption" color={colors.warning}>The document was long and was truncated while parsing.</Text> : null}
            <Field label="Course title" value={course.title} onChangeText={(t) => setCourse({ ...course, title: t })} />
            <Field label="Description" value={course.description} onChangeText={(t) => setCourse({ ...course, description: t })} multiline />
            <OptionPicker label="Level" value={course.level} options={LEVELS} onChange={(level) => setCourse({ ...course, level })} />
            <Text variant="caption">
              {course.modules.length} modules · {lessons} lessons · {questions} questions
            </Text>
          </Card>

          {parsed.errors.length ? (
            <Card style={{ gap: 6, borderColor: colors.danger }}>
              <Text variant="label" color={colors.danger}>Must fix before importing</Text>
              {parsed.errors.map((e) => (
                <Text key={e} variant="caption">• {e}</Text>
              ))}
              <Text variant="caption">Fix these in the document, or import it on the website where every lesson can be edited.</Text>
            </Card>
          ) : null}
          {parsed.warnings.length ? (
            <Card style={{ gap: 6 }}>
              <Text variant="label" color={colors.warning}>Warnings</Text>
              {parsed.warnings.map((w) => (
                <Text key={w} variant="caption">• {w}</Text>
              ))}
            </Card>
          ) : null}

          <Card style={{ gap: 10 }}>
            <Text variant="label">Outline</Text>
            {course.modules.map((m, mi) => (
              <View key={mi} style={{ gap: 4 }}>
                {mi > 0 ? <Divider /> : null}
                <Text weight="semibold">Module {mi + 1}: {m.title}</Text>
                {m.lessons.map((l, li) => (
                  <Text key={li} variant="caption">
                    {li + 1}. {l.title}
                    {l.questions?.length ? ` · ${l.questions.length}q` : ""}
                    {l.assignment ? " · assignment" : ""}
                  </Text>
                ))}
              </View>
            ))}
          </Card>

          <Button title="Import as draft" onPress={doImport} loading={importing} disabled={blocked} fullWidth />
        </>
      ) : null}
    </Screen>
  );
}
