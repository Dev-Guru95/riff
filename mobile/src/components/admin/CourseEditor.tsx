// Course editor building blocks — native ports of the web's
// admin/courses/[id]/EditClient.tsx (ModuleHeader, LessonEditor) and
// LessonBuilder.tsx (AddModuleForm, AddLessonForm). Same routes, same payloads.

import { useState } from "react";
import { Alert, View } from "react-native";

import { Button, Card, Chip, Divider, Field, Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";
import type { AdminLesson } from "@/types/api";
import { CheckRow, Label, NumberField } from "./controls";
import { QuizBuilder, quizProblem, toEditable, toPayload, type QEdit } from "./QuizBuilder";
import { useAdminAction } from "./useAdminAction";

/** Every course write refreshes the list and the editor tree (prefix match). */
export const COURSES_PATH = "/api/mobile/admin/courses";

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n || 0)));

// ---------- Module: rename + delete + lessons ----------

export function ModuleCard({
  id,
  index,
  title,
  lessons,
}: {
  id: string;
  index: number;
  title: string;
  lessons: AdminLesson[];
}) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);

  async function save() {
    if (name.trim().length < 2) return Alert.alert("Module title", "Use at least 2 characters.");
    const res = await run(`/api/admin/modules/${id}`, "PATCH", { title: name.trim() }, "Module renamed");
    if (res) setEditing(false);
  }

  function remove() {
    Alert.alert(
      "Delete module?",
      `This deletes "${title}" and its ${lessons.length} lesson(s). Earned XP will be reversed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run(`/api/admin/modules/${id}`, "DELETE", undefined, "Module deleted") },
      ],
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      {editing ? (
        <View style={{ gap: 8 }}>
          <Field label="Module title" value={name} onChangeText={setName} autoFocus returnKeyType="done" onSubmitEditing={save} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Save" size="sm" onPress={save} loading={busy} disabled={!name.trim()} />
            <Button
              title="Cancel"
              size="sm"
              variant="ghost"
              onPress={() => {
                setName(title);
                setEditing(false);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text variant="heading">Module {index + 1}: {title}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Rename" size="sm" variant="ghost" icon="pencil" onPress={() => setEditing(true)} />
            <Button title="Delete" size="sm" variant="danger" onPress={remove} disabled={busy} />
          </View>
        </View>
      )}

      <View style={{ gap: 8 }}>
        {lessons.map((l, li) => (
          <LessonEditor key={l.id} index={li} lesson={l} />
        ))}
        {lessons.length === 0 ? <Text variant="caption">No lessons yet.</Text> : null}
      </View>

      <AddLessonForm moduleId={id} />
    </Card>
  );
}

// ---------- Lesson editor ----------

function LessonEditor({ index, lesson }: { index: number; lesson: AdminLesson }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);
  const [xp, setXp] = useState(lesson.xpReward);
  const [minutes, setMinutes] = useState(lesson.estMinutes);

  const [passThreshold, setPassThreshold] = useState(lesson.quiz?.passThreshold ?? 80);
  const [questions, setQuestions] = useState<QEdit[]>(() => toEditable(lesson.quiz?.questions ?? []));

  const [hasAssignment, setHasAssignment] = useState(!!lesson.assignment);
  const [aTitle, setATitle] = useState(lesson.assignment?.title ?? "");
  const [aInstr, setAInstr] = useState(lesson.assignment?.instructions ?? "");
  const [aXp, setAXp] = useState(lesson.assignment?.xpReward ?? 60);
  const [aPass, setAPass] = useState(lesson.assignment?.minPassingScore ?? 60);

  async function saveLesson() {
    if (title.trim().length < 2) return Alert.alert("Lesson title", "Use at least 2 characters.");
    if (!content.trim()) return Alert.alert("Lesson content", "Content can't be empty.");
    await run(
      `/api/admin/lessons/${lesson.id}`,
      "PATCH",
      { title: title.trim(), content, xpReward: clampInt(xp, 0, 500), estMinutes: clampInt(minutes, 1, 120) },
      "Lesson saved",
    );
  }

  async function saveQuiz() {
    const problem = quizProblem(questions);
    if (problem) return Alert.alert("Quiz", problem);
    const doSave = () =>
      void run(
        `/api/admin/lessons/${lesson.id}/quiz`,
        "PUT",
        { passThreshold: clampInt(passThreshold, 0, 100), questions: toPayload(questions) },
        questions.length ? "Quiz saved" : "Quiz removed",
      );
    if (questions.length === 0 && lesson.quiz) {
      Alert.alert("Remove quiz?", "Saving with no questions removes this lesson's quiz.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doSave },
      ]);
      return;
    }
    doSave();
  }

  async function saveAssignment() {
    if (!hasAssignment) {
      if (!lesson.assignment) return;
      Alert.alert("Remove assignment?", "Artists will no longer submit work for this lesson.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void run(`/api/admin/lessons/${lesson.id}/assignment`, "PUT", { remove: true }, "Assignment removed"),
        },
      ]);
      return;
    }
    if (!aTitle.trim() || !aInstr.trim()) return Alert.alert("Assignment", "Title and instructions are required.");
    await run(
      `/api/admin/lessons/${lesson.id}/assignment`,
      "PUT",
      { title: aTitle.trim(), instructions: aInstr, xpReward: clampInt(aXp, 0, 500), minPassingScore: clampInt(aPass, 0, 100) },
      "Assignment saved",
    );
  }

  function deleteLesson() {
    Alert.alert("Delete lesson?", `"${lesson.title}" will be deleted. Earned XP will be reversed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void run(`/api/admin/lessons/${lesson.id}`, "DELETE", undefined, "Lesson deleted") },
    ]);
  }

  if (!open) {
    return (
      <Card onPress={() => setOpen(true)} style={{ padding: 12, gap: 4, backgroundColor: colors.surface2 }} accessibilityLabel={`Edit lesson ${index + 1}: ${lesson.title}`}>
        <Text weight="medium">{index + 1}. {lesson.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <Text variant="caption">+{lesson.xpReward} XP · {lesson.estMinutes} min</Text>
          {lesson.quiz ? <Chip label={`Quiz (${lesson.quiz.questions.length}q)`} tone="accent" /> : null}
          {lesson.assignment ? <Chip label="Assignment" tone="brand" /> : null}
          <Text variant="caption" color={colors.accent} style={{ marginLeft: "auto" }}>Edit</Text>
        </View>
      </Card>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.brand, borderRadius: radius.xl, padding: 12, gap: 12 }}>
      <Label right={<Button title="Close" size="sm" variant="link" onPress={() => setOpen(false)} />}>Editing lesson {index + 1}</Label>

      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Content (supports **bold**)" value={content} onChangeText={setContent} multiline />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NumberField label="XP reward" value={xp} onChange={setXp} hint="0–500" />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Minutes" value={minutes} onChange={setMinutes} hint="1–120" />
        </View>
      </View>
      <Button title="Save lesson" size="sm" onPress={saveLesson} loading={busy} />

      <Divider />
      <Label>Quiz ({questions.length})</Label>
      <NumberField label="Pass threshold (%)" value={passThreshold} onChange={setPassThreshold} />
      <QuizBuilder questions={questions} onChange={setQuestions} />
      {questions.length === 0 ? <Text variant="caption">No quiz. Add a question, or saving with none removes the quiz.</Text> : null}
      <Button title="Save quiz" size="sm" onPress={saveQuiz} loading={busy} />

      <Divider />
      <CheckRow label="Has an AI-reviewed assignment" checked={hasAssignment} onChange={setHasAssignment} />
      {hasAssignment ? (
        <View style={{ gap: 10 }}>
          <Field label="Assignment title" value={aTitle} onChangeText={setATitle} />
          <Field label="Instructions" value={aInstr} onChangeText={setAInstr} multiline />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <NumberField label="XP reward" value={aXp} onChange={setAXp} />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="Pass mark" value={aPass} onChange={setAPass} />
            </View>
          </View>
        </View>
      ) : null}
      <Button
        title={hasAssignment ? "Save assignment" : "Save (no assignment)"}
        size="sm"
        onPress={saveAssignment}
        loading={busy}
        disabled={!hasAssignment && !lesson.assignment}
      />

      <Divider />
      <Button title="Delete lesson" variant="danger" size="sm" onPress={deleteLesson} disabled={busy} />
    </View>
  );
}

// ---------- Add lesson ----------

function AddLessonForm({ moduleId }: { moduleId: string }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [xpReward, setXpReward] = useState(20);
  const [questions, setQuestions] = useState<QEdit[]>([]);
  const [hasAssignment, setHasAssignment] = useState(false);
  const [aTitle, setATitle] = useState("");
  const [aInstr, setAInstr] = useState("");

  function reset() {
    setTitle("");
    setContent("");
    setXpReward(20);
    setQuestions([]);
    setHasAssignment(false);
    setATitle("");
    setAInstr("");
    setOpen(false);
  }

  async function submit() {
    if (title.trim().length < 2) return Alert.alert("Lesson title", "Use at least 2 characters.");
    if (!content.trim()) return Alert.alert("Lesson content", "Content can't be empty.");
    const problem = quizProblem(questions);
    if (problem) return Alert.alert("Quiz", problem);
    if (hasAssignment && (!aTitle.trim() || !aInstr.trim())) return Alert.alert("Assignment", "Title and instructions are required.");

    const res = await run(
      `/api/admin/modules/${moduleId}/lessons`,
      "POST",
      {
        title: title.trim(),
        content,
        xpReward: clampInt(xpReward, 0, 500),
        quiz: questions.length ? { passThreshold: 80, questions: toPayload(questions) } : undefined,
        assignment: hasAssignment ? { title: aTitle.trim(), instructions: aInstr, rubric: [] } : undefined,
      },
      "Lesson created",
    );
    if (res) reset();
  }

  if (!open) return <Button title="+ Add lesson" variant="ghost" size="sm" onPress={() => setOpen(true)} />;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, gap: 12 }}>
      <Label>New lesson</Label>
      <Field label="Lesson title" value={title} onChangeText={setTitle} />
      <Field label="Content (supports **bold**)" value={content} onChangeText={setContent} multiline />
      <NumberField label="XP reward" value={xpReward} onChange={setXpReward} hint="0–500" />

      <Divider />
      <Label>Quiz ({questions.length})</Label>
      <QuizBuilder questions={questions} onChange={setQuestions} />

      <Divider />
      <CheckRow label="Add an AI-reviewed assignment" checked={hasAssignment} onChange={setHasAssignment} />
      {hasAssignment ? (
        <View style={{ gap: 10 }}>
          <Field label="Assignment title" value={aTitle} onChangeText={setATitle} />
          <Field label="Instructions" value={aInstr} onChangeText={setAInstr} multiline />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Create lesson" onPress={submit} loading={busy} disabled={!title.trim() || !content.trim()} />
        <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

// ---------- Add module ----------

export function AddModuleForm({ courseId }: { courseId: string }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [title, setTitle] = useState("");

  async function submit() {
    if (title.trim().length < 2) return Alert.alert("Module title", "Use at least 2 characters.");
    const res = await run(`/api/admin/courses/${courseId}/modules`, "POST", { title: title.trim() }, "Module added");
    if (res) setTitle("");
  }

  return (
    <Card style={{ gap: 10 }}>
      <Field label="New module title" placeholder="e.g. Release Strategy" value={title} onChangeText={setTitle} returnKeyType="done" onSubmitEditing={submit} />
      <Button title="+ Add module" variant="ghost" onPress={submit} loading={busy} disabled={!title.trim()} />
    </Card>
  );
}
