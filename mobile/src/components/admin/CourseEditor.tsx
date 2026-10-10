// Course editor building blocks — native ports of the web's
// admin/courses/[id]/EditClient.tsx (ModuleHeader, LessonEditor) and
// LessonBuilder.tsx (AddModuleForm, AddLessonForm). Same routes, same payloads,
// same labels and placeholders.

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Button, Card, Divider, Field, Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";
import type { AdminLesson } from "@/types/api";
import { CardTitle, CheckRow, InlineMsg, Label, NumberField } from "./controls";
import { emptyQuestion, QuizBuilder, quizProblem, toEditable, toPayload, type QEdit } from "./QuizBuilder";
import { useAdminCall } from "./useAdminAction";

/** Every course write refreshes the list and the editor tree (prefix match). */
export const COURSES_PATH = "/api/mobile/admin/courses";

/** A small text action (the web's `text-xs` link-style buttons). */
function TextAction({ label, onPress, color = colors.muted, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={10} style={{ paddingVertical: 4, opacity: disabled ? 0.5 : 1 }}>
      <Text variant="caption" color={color}>{label}</Text>
    </Pressable>
  );
}

// ---------- Module card: header (rename + delete), lessons, add lesson ----------

export function ModuleCard({ id, index, title, lessons }: { id: string; index: number; title: string; lessons: AdminLesson[] }) {
  return (
    <Card style={{ padding: 20 }}>
      <ModuleHeader id={id} index={index} title={title} lessonCount={lessons.length} />
      <View style={{ gap: 8, marginVertical: 16 }}>
        {lessons.map((l, li) => (
          <LessonEditor key={l.id} index={li} lesson={l} />
        ))}
        {lessons.length === 0 ? <Text variant="caption">No lessons yet.</Text> : null}
      </View>
      <AddLessonForm moduleId={id} />
    </Card>
  );
}

function ModuleHeader({ id, index, title, lessonCount }: { id: string; index: number; title: string; lessonCount: number }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);

  async function save() {
    const res = await call(`/api/admin/modules/${id}`, "PATCH", { title: name });
    if (res.ok) setEditing(false);
    else if (res.error) Alert.alert("Couldn't rename the module", res.error);
  }

  function remove() {
    Alert.alert("Delete module?", `Delete this module and its ${lessonCount} lesson(s)? Earned XP will be reversed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await call(`/api/admin/modules/${id}`, "DELETE");
          if (!res.ok && res.error) Alert.alert("Couldn't delete the module", res.error);
        },
      },
    ]);
  }

  if (editing) {
    return (
      <View style={{ gap: 8 }}>
        <Field value={name} onChangeText={setName} autoFocus returnKeyType="done" onSubmitEditing={() => name && void save()} accessibilityLabel="Module title" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Save" size="sm" onPress={save} disabled={busy || !name} />
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
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <CardTitle size={16} style={{ flex: 1 }}>
        Module {index + 1}: {title}
      </CardTitle>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TextAction label="Rename" onPress={() => setEditing(true)} />
        <TextAction label="Delete" onPress={remove} disabled={busy} />
      </View>
    </View>
  );
}

// ---------- Lesson editor ----------

function LessonEditor({ index, lesson }: { index: number; lesson: AdminLesson }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);
  const [xp, setXp] = useState(lesson.xpReward);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [passThreshold, setPassThreshold] = useState(lesson.quiz?.passThreshold ?? 80);
  const [questions, setQuestions] = useState<QEdit[]>(() => toEditable(lesson.quiz?.questions ?? []));

  const [hasAssignment, setHasAssignment] = useState(!!lesson.assignment);
  const [aTitle, setATitle] = useState(lesson.assignment?.title ?? "");
  const [aInstr, setAInstr] = useState(lesson.assignment?.instructions ?? "");

  // The web's flash(): the message clears itself after 2.5s.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2500);
  }

  async function saveLesson() {
    const res = await call(`/api/admin/lessons/${lesson.id}`, "PATCH", { title, content, xpReward: xp });
    if (res.ok) flash(true, "Lesson saved");
    else if (res.error) flash(false, res.error);
  }

  async function saveQuiz() {
    const problem = quizProblem(questions);
    if (problem) return flash(false, `Quiz save failed — ${problem}`);
    const res = await call(`/api/admin/lessons/${lesson.id}/quiz`, "PUT", { passThreshold, questions: toPayload(questions) });
    if (res.ok) flash(true, "Quiz saved");
    else if (res.error) flash(false, "Quiz save failed");
  }

  async function saveAssignment() {
    const body = hasAssignment ? { title: aTitle, instructions: aInstr } : { remove: true };
    const res = await call(`/api/admin/lessons/${lesson.id}/assignment`, "PUT", body);
    if (res.ok) flash(true, "Assignment saved");
    else if (res.error) flash(false, "Assignment save failed");
  }

  function deleteLesson() {
    Alert.alert("Delete lesson?", "Delete this lesson? Earned XP will be reversed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await call(`/api/admin/lessons/${lesson.id}`, "DELETE");
          if (!res.ok && res.error) flash(false, res.error);
        },
      },
    ]);
  }

  if (!open) {
    return (
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}>
        <Text>
          {index + 1}. {lesson.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12 }}>
          <Text variant="caption">+{lesson.xpReward} XP</Text>
          {lesson.quiz ? <Text variant="caption">· Quiz ({lesson.quiz.questions.length}q)</Text> : null}
          {lesson.assignment ? <Text variant="caption">· Assignment</Text> : null}
          <View style={{ marginLeft: "auto" }}>
            <TextAction label="Edit" color={colors.accent} onPress={() => setOpen(true)} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.brand, borderRadius: radius.card, padding: 16, gap: 16 }}>
      <Label right={<TextAction label="Close" onPress={() => setOpen(false)} />}>Editing lesson {index + 1}</Label>

      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Content (supports **bold**)" value={content} onChangeText={setContent} multiline style={{ minHeight: 128 }} />
      <View style={{ width: 128 }}>
        <NumberField label="XP reward" value={xp} onChange={setXp} />
      </View>
      <Button title="Save lesson" size="sm" onPress={saveLesson} disabled={busy} />

      <Divider />
      <View style={{ gap: 8 }}>
        <Label
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="+ Question" variant="ghost" size="sm" onPress={() => setQuestions((q) => [...q, emptyQuestion()])} />
              <Button title="Save quiz" size="sm" onPress={saveQuiz} disabled={busy} />
            </View>
          }
        >
          Quiz ({questions.length})
        </Label>
        <View style={{ width: 128 }}>
          <NumberField label="Pass threshold" value={passThreshold} onChange={setPassThreshold} />
        </View>
        <QuizBuilder questions={questions} onChange={setQuestions} removable explanationPlaceholder="Explanation" />
        {questions.length === 0 ? <Text variant="caption">No quiz. Add a question, or saving with none removes the quiz.</Text> : null}
      </View>

      <Divider />
      <View style={{ gap: 8 }}>
        <CheckRow label="Has an AI-reviewed assignment" checked={hasAssignment} onChange={setHasAssignment} />
        {hasAssignment ? (
          <>
            <Field placeholder="Assignment title" value={aTitle} onChangeText={setATitle} />
            <Field placeholder="Instructions" value={aInstr} onChangeText={setAInstr} multiline style={{ minHeight: 64 }} />
          </>
        ) : null}
        <Button title="Save assignment" size="sm" onPress={saveAssignment} disabled={busy} />
      </View>

      <Divider />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>{msg ? <InlineMsg ok={msg.ok} small>{msg.text}</InlineMsg> : null}</View>
        <Button title="Delete lesson" variant="danger" size="sm" onPress={deleteLesson} disabled={busy} />
      </View>
    </View>
  );
}

// ---------- Add lesson ----------

function AddLessonForm({ moduleId }: { moduleId: string }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [xpReward, setXpReward] = useState(20);
  const [questions, setQuestions] = useState<QEdit[]>([]);
  const [hasAssignment, setHasAssignment] = useState(false);
  const [aTitle, setATitle] = useState("");
  const [aInstr, setAInstr] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const problem = quizProblem(questions);
    if (problem) return setErr(problem);
    const res = await call(`/api/admin/modules/${moduleId}/lessons`, "POST", {
      title,
      content,
      xpReward,
      quiz: questions.length > 0 ? { passThreshold: 80, questions: toPayload(questions) } : undefined,
      assignment: hasAssignment ? { title: aTitle, instructions: aInstr, rubric: [] } : undefined,
    });
    if (res.ok) {
      setTitle("");
      setContent("");
      setQuestions([]);
      setHasAssignment(false);
      setATitle("");
      setAInstr("");
      setOpen(false);
    } else if (res.error) {
      setErr(res.error || "Failed to create lesson");
    }
  }

  if (!open) return <Button title="+ Add lesson" variant="ghost" size="sm" onPress={() => setOpen(true)} />;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: 16, gap: 12, marginTop: 8 }}>
      <Field label="Lesson title" value={title} onChangeText={setTitle} />
      <Field label="Content (supports **bold**)" value={content} onChangeText={setContent} multiline style={{ minHeight: 96 }} />
      <View style={{ width: 128 }}>
        <NumberField label="XP reward" value={xpReward} onChange={setXpReward} />
      </View>

      <Divider />
      <View style={{ gap: 8 }}>
        <Label right={<Button title="+ Question" variant="ghost" size="sm" onPress={() => setQuestions((q) => [...q, emptyQuestion()])} />}>
          Quiz ({questions.length})
        </Label>
        <QuizBuilder questions={questions} onChange={setQuestions} explanationPlaceholder="Explanation (shown after answering)" />
      </View>

      <Divider />
      <View style={{ gap: 8 }}>
        <CheckRow label="Add an AI-reviewed assignment" checked={hasAssignment} onChange={setHasAssignment} />
        {hasAssignment ? (
          <>
            <Field label="Assignment title" value={aTitle} onChangeText={setATitle} />
            <Field label="Instructions" value={aInstr} onChangeText={setAInstr} multiline style={{ minHeight: 64 }} />
          </>
        ) : null}
      </View>

      {err ? <InlineMsg ok={false}>{err}</InlineMsg> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={busy ? "Saving…" : "Create lesson"} onPress={submit} disabled={busy || !title || !content} />
        <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

// ---------- Add module ----------

export function AddModuleForm({ courseId }: { courseId: string }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  const [title, setTitle] = useState("");

  async function submit() {
    const res = await call(`/api/admin/courses/${courseId}/modules`, "POST", { title });
    if (res.ok) setTitle("");
    else if (res.error) Alert.alert("Couldn't add the module", res.error);
  }

  return (
    <Card style={{ gap: 8 }}>
      <Field label="New module title" placeholder="e.g. Release Strategy" value={title} onChangeText={setTitle} returnKeyType="done" onSubmitEditing={() => title && void submit()} />
      <Button title="+ Add module" variant="ghost" onPress={submit} disabled={busy || !title} />
    </Card>
  );
}
