// Review & edit step of the course importer — a native port of PreviewStep,
// ModuleEditor, LessonEditor, QuestionEditor, AssignmentEditor and
// ValidationPanel from the web's src/app/(admin)/admin/import/ImportClient.tsx.
// Every module, lesson, question, option and assignment is editable, movable
// and removable before the import, with the same live validation.

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, Card, Field, Text } from "@/components/ui";
import { colors, radius, tint } from "@/theme/tokens";
import { OptionPicker, RadioDot } from "./controls";
import {
  countEntities,
  nextOptionId,
  swap,
  validateCourse,
  type ParsedCourse,
  type ParsedLesson,
  type ParsedModule,
  type ParsedQuestion,
  type QuestionType,
} from "./importModel";

export type Mutate = (fn: (c: ParsedCourse) => void) => void;
export type ParseMeta = { method: "ai" | "heuristic"; format: string; truncated: boolean; sourceFile: string };

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const QTYPES: { value: QuestionType; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "multi", label: "Multi" },
  { value: "truefalse", label: "True/False" },
];

export function PreviewStep({
  course,
  meta,
  busy,
  mutate,
  onCancel,
  onImport,
}: {
  course: ParsedCourse;
  meta: ParseMeta;
  busy: boolean;
  mutate: Mutate;
  onCancel: () => void;
  onImport: () => void;
}) {
  const report = useMemo(() => validateCourse(course), [course]);
  const counts = useMemo(() => countEntities(course), [course]);
  const blocked = report.errors.length > 0;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Badge>{meta.method === "ai" ? "🤖 AI-parsed" : "⚙️ Auto-parsed"}</Badge>
        <Badge>{meta.format.toUpperCase()}</Badge>
        <Badge>{meta.sourceFile}</Badge>
        <Badge>
          {counts.modules} modules · {counts.lessons} lessons · {counts.questions} questions · {counts.assignments} assignments
        </Badge>
      </View>

      {meta.truncated ? (
        <Card style={{ padding: 12, borderColor: colors.warning }}>
          <Text variant="caption" color={colors.warning}>
            The document was long and was truncated for parsing — check that the tail of the course imported fully.
          </Text>
        </Card>
      ) : null}

      <ValidationPanel report={report} />

      <Card style={{ padding: 20, gap: 12 }}>
        <Field label="Course title" value={course.title} onChangeText={(t) => mutate((c) => void (c.title = t))} />
        <Field
          label="Description"
          value={course.description}
          onChangeText={(t) => mutate((c) => void (c.description = t))}
          multiline
          style={{ minHeight: 60 }}
        />
        <OptionPicker label="Level" value={course.level} options={[...LEVELS]} onChange={(level) => mutate((c) => void (c.level = level))} />
      </Card>

      {course.modules.map((mod, mi) => (
        <ModuleEditor key={mi} module={mod} mi={mi} total={course.modules.length} mutate={mutate} />
      ))}

      <Button
        title="+ Add module"
        variant="ghost"
        size="sm"
        onPress={() => mutate((c) => void c.modules.push({ title: `Module ${c.modules.length + 1}`, lessons: [] }))}
      />

      <View style={styles.actions}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Button title={busy ? "Importing…" : "Approve & import"} onPress={onImport} disabled={busy || blocked} accessibilityLabel={blocked ? "Approve & import. Fix the errors above before importing" : "Approve & import"} />
          <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
        </View>
        {blocked ? <Text variant="caption" color={colors.danger}>Resolve {report.errors.length} error(s) to enable import.</Text> : null}
      </View>
    </View>
  );
}

function ModuleEditor({ module: mod, mi, total, mutate }: { module: ParsedModule; mi: number; total: number; mutate: Mutate }) {
  return (
    <Card style={{ gap: 12, borderLeftWidth: 2, borderLeftColor: colors.brand }}>
      <View style={styles.headRow}>
        <Text variant="caption">Module {mi + 1}</Text>
        <MoveDelete
          what={`module ${mi + 1}`}
          onUp={mi > 0 ? () => mutate((c) => swap(c.modules, mi, mi - 1)) : undefined}
          onDown={mi < total - 1 ? () => mutate((c) => swap(c.modules, mi, mi + 1)) : undefined}
          onDelete={() => mutate((c) => void c.modules.splice(mi, 1))}
        />
      </View>
      <Field value={mod.title} onChangeText={(t) => mutate((c) => void (c.modules[mi]!.title = t))} accessibilityLabel={`Module ${mi + 1} title`} />

      <View style={{ paddingLeft: 12, gap: 12, borderLeftWidth: 1, borderLeftColor: colors.border }}>
        {mod.lessons.map((lesson, li) => (
          <LessonEditor key={li} lesson={lesson} mi={mi} li={li} total={mod.lessons.length} mutate={mutate} />
        ))}
        <Button
          title="+ Add lesson"
          variant="ghost"
          size="sm"
          onPress={() =>
            mutate(
              (c) =>
                void c.modules[mi]!.lessons.push({
                  title: `Lesson ${mod.lessons.length + 1}`,
                  content: "",
                  estMinutes: 6,
                  questions: [],
                  assignment: null,
                }),
            )
          }
        />
      </View>
    </Card>
  );
}

function LessonEditor({ lesson, mi, li, total, mutate }: { lesson: ParsedLesson; mi: number; li: number; total: number; mutate: Mutate }) {
  const [open, setOpen] = useState(true);
  const L = (c: ParsedCourse) => c.modules[mi]!.lessons[li]!;
  return (
    <View style={styles.lesson}>
      <View style={styles.headRow}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? "Collapse" : "Expand"} lesson ${li + 1}`}
          hitSlop={10}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 }}
        >
          <Text variant="caption" style={{ width: 12 }}>{open ? "▾" : "▸"}</Text>
          <Text variant="caption">Lesson {li + 1}</Text>
        </Pressable>
        <MoveDelete
          what={`lesson ${li + 1}`}
          onUp={li > 0 ? () => mutate((c) => swap(c.modules[mi]!.lessons, li, li - 1)) : undefined}
          onDown={li < total - 1 ? () => mutate((c) => swap(c.modules[mi]!.lessons, li, li + 1)) : undefined}
          onDelete={() => mutate((c) => void c.modules[mi]!.lessons.splice(li, 1))}
        />
      </View>
      <Field value={lesson.title} onChangeText={(t) => mutate((c) => void (L(c).title = t))} accessibilityLabel={`Lesson ${li + 1} title`} />

      {open ? (
        <View style={{ gap: 12 }}>
          <Field
            label="Lesson content (markdown)"
            value={lesson.content}
            onChangeText={(t) => mutate((c) => void (L(c).content = t))}
            multiline
            style={{ minHeight: 70 }}
          />

          <View style={{ gap: 8 }}>
            <Text variant="caption" weight="semibold">Quiz questions ({lesson.questions.length})</Text>
            {lesson.questions.map((q, qi) => (
              <QuestionEditor key={qi} q={q} mi={mi} li={li} qi={qi} mutate={mutate} />
            ))}
            <Button
              title="+ Add question"
              variant="ghost"
              size="sm"
              onPress={() =>
                mutate(
                  (c) =>
                    void L(c).questions.push({
                      type: "single",
                      prompt: "",
                      options: [
                        { id: "a", text: "" },
                        { id: "b", text: "" },
                      ],
                      correct: [],
                      explanation: "",
                    }),
                )
              }
            />
          </View>

          <AssignmentEditor lesson={lesson} mi={mi} li={li} mutate={mutate} />
        </View>
      ) : null}
    </View>
  );
}

function QuestionEditor({ q, mi, li, qi, mutate }: { q: ParsedQuestion; mi: number; li: number; qi: number; mutate: Mutate }) {
  const Q = (c: ParsedCourse) => c.modules[mi]!.lessons[li]!.questions[qi]!;

  function setType(type: QuestionType) {
    mutate((c) => {
      const qq = Q(c);
      qq.type = type;
      if (type === "truefalse") {
        qq.options = [
          { id: "a", text: "True" },
          { id: "b", text: "False" },
        ];
        qq.correct = qq.correct.filter((id) => id === "a" || id === "b").slice(0, 1);
      }
      if (type === "single") qq.correct = qq.correct.slice(0, 1);
    });
  }

  function toggleCorrect(id: string) {
    mutate((c) => {
      const qq = Q(c);
      if (qq.type === "multi") qq.correct = qq.correct.includes(id) ? qq.correct.filter((x) => x !== id) : [...qq.correct, id];
      else qq.correct = [id];
    });
  }

  return (
    <View style={styles.question}>
      <View style={styles.headRow}>
        <Text variant="caption">Q{qi + 1}</Text>
        <IconAction label="✕" accessibilityLabel={`Remove question ${qi + 1}`} danger onPress={() => mutate((c) => void c.modules[mi]!.lessons[li]!.questions.splice(qi, 1))} />
      </View>
      <Field placeholder="Question prompt" value={q.prompt} onChangeText={(t) => mutate((c) => void (Q(c).prompt = t))} accessibilityLabel={`Question ${qi + 1} prompt`} />
      <OptionPicker compact value={q.type} options={QTYPES} onChange={setType} />

      <View style={{ gap: 4, paddingLeft: 8 }}>
        {q.options.map((o, oi) => (
          <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <RadioDot multi={q.type === "multi"} selected={q.correct.includes(o.id)} onPress={() => toggleCorrect(o.id)} label={`Mark ${o.id} correct`} />
            <Text variant="caption" style={{ width: 16 }}>{o.id}.</Text>
            <View style={{ flex: 1 }}>
              <Field
                value={o.text}
                editable={q.type !== "truefalse"}
                onChangeText={(t) => mutate((c) => void (Q(c).options[oi]!.text = t))}
                accessibilityLabel={`Option ${o.id}`}
                style={q.type === "truefalse" ? { opacity: 0.6 } : undefined}
              />
            </View>
            {q.type !== "truefalse" && q.options.length > 2 ? (
              <IconAction
                label="✕"
                danger
                accessibilityLabel={`Remove option ${o.id}`}
                onPress={() =>
                  mutate((c) => {
                    const qq = Q(c);
                    const removed = qq.options[oi]!.id;
                    qq.options.splice(oi, 1);
                    qq.correct = qq.correct.filter((x) => x !== removed);
                  })
                }
              />
            ) : null}
          </View>
        ))}
        {q.type !== "truefalse" ? (
          <Text
            variant="caption"
            accessibilityRole="button"
            onPress={() =>
              mutate((c) => {
                const qq = Q(c);
                qq.options.push({ id: nextOptionId(qq.options), text: "" });
              })
            }
            style={{ alignSelf: "flex-start", paddingVertical: 6 }}
          >
            + option
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function AssignmentEditor({ lesson, mi, li, mutate }: { lesson: ParsedLesson; mi: number; li: number; mutate: Mutate }) {
  const L = (c: ParsedCourse) => c.modules[mi]!.lessons[li]!;
  if (!lesson.assignment) {
    return (
      <Button
        title="+ Add assignment (short answer)"
        variant="ghost"
        size="sm"
        onPress={() => mutate((c) => void (L(c).assignment = { title: "Short-answer assignment", instructions: "" }))}
      />
    );
  }
  return (
    <View style={styles.assignment}>
      <View style={styles.headRow}>
        <Text variant="caption" weight="semibold">Assignment</Text>
        <Text variant="caption" color={colors.danger} accessibilityRole="button" onPress={() => mutate((c) => void (L(c).assignment = null))} style={{ paddingVertical: 6 }}>
          Remove
        </Text>
      </View>
      <Field placeholder="Assignment title" value={lesson.assignment.title} onChangeText={(t) => mutate((c) => void (L(c).assignment!.title = t))} />
      <Field
        placeholder="Instructions / prompt"
        value={lesson.assignment.instructions}
        onChangeText={(t) => mutate((c) => void (L(c).assignment!.instructions = t))}
        multiline
        style={{ minHeight: 60 }}
      />
    </View>
  );
}

function ValidationPanel({ report }: { report: { errors: string[]; warnings: string[] } }) {
  if (!report.errors.length && !report.warnings.length) {
    return (
      <Card style={{ padding: 12, borderColor: colors.success }}>
        <Text variant="caption" color={colors.success}>✓ No issues found — ready to import.</Text>
      </Card>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {report.errors.length > 0 ? (
        <Card style={{ padding: 12, gap: 4, borderColor: colors.danger }}>
          <Text variant="caption" weight="semibold" color={colors.danger}>Errors ({report.errors.length}) — must fix</Text>
          {report.errors.map((e, i) => (
            <Text key={i} variant="caption" color={colors.danger}>• {e}</Text>
          ))}
        </Card>
      ) : null}
      {report.warnings.length > 0 ? (
        <Card style={{ padding: 12, gap: 4, borderColor: colors.warning }}>
          <Text variant="caption" weight="semibold" color={colors.warning}>Warnings ({report.warnings.length})</Text>
          {report.warnings.map((w, i) => (
            <Text key={i} variant="caption" color={colors.warning}>• {w}</Text>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

// ---- small UI bits ----

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text variant="caption" numberOfLines={1}>{children}</Text>
    </View>
  );
}

function IconAction({ label, onPress, disabled, danger, accessibilityLabel }: { label: string; onPress?: () => void; disabled?: boolean; danger?: boolean; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || !onPress }}
      hitSlop={6}
      style={({ pressed }) => [styles.iconAction, (disabled || !onPress) && { opacity: 0.3 }, pressed && { backgroundColor: colors.surface2 }]}
    >
      <Text variant="caption" color={danger ? colors.danger : colors.foreground}>{label}</Text>
    </Pressable>
  );
}

function MoveDelete({ what, onUp, onDown, onDelete }: { what: string; onUp?: () => void; onDown?: () => void; onDelete: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <IconAction label="↑" accessibilityLabel={`Move ${what} up`} onPress={onUp} />
      <IconAction label="↓" accessibilityLabel={`Move ${what} down`} onPress={onDown} />
      <IconAction label="✕" accessibilityLabel={`Delete ${what}`} danger onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lesson: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 8 },
  question: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md - 2, padding: 8, gap: 8, backgroundColor: tint(colors.surface2, 0.4) },
  assignment: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.md - 2, padding: 8, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, maxWidth: "100%" },
  iconAction: { minWidth: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  actions: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
