// Quiz question editor shared by "Add lesson" and "Edit lesson" — the native
// version of the quiz blocks in the web's LessonBuilder.tsx / EditClient.tsx.
// Single-answer questions; option ids are a, b, c… exactly as the web sends them.

import { View } from "react-native";

import { Button, Field, Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";
import type { AdminQuizQuestion } from "@/types/api";
import { RadioDot } from "./controls";

export type QEdit = { prompt: string; options: string[]; correctIdx: number; explanation: string };

const letter = (i: number) => String.fromCharCode(97 + i);

export const emptyQuestion = (): QEdit => ({ prompt: "", options: ["", ""], correctIdx: 0, explanation: "" });

/** Server questions → editable rows (same mapping as EditClient.tsx). */
export function toEditable(questions: AdminQuizQuestion[]): QEdit[] {
  return questions.map((q) => ({
    prompt: q.prompt,
    options: q.options.map((o) => o.text),
    correctIdx: Math.max(0, q.options.findIndex((o) => q.correct.includes(o.id))),
    explanation: q.explanation,
  }));
}

/** Editable rows → the `questions` array the quiz routes accept (same as the web). */
export function toPayload(questions: QEdit[]) {
  return questions.map((q) => ({
    prompt: q.prompt,
    options: q.options.filter((o) => o.trim()).map((text, i) => ({ id: letter(i), text })),
    correct: [letter(q.correctIdx)],
    explanation: q.explanation,
  }));
}

/** Mirrors the routes' zod rules so the problem can be named before sending. */
export function quizProblem(questions: QEdit[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const filled = q.options.filter((o) => o.trim());
    if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
    if (filled.length < 2) return `Question ${i + 1} needs at least two options.`;
    if (!q.options[q.correctIdx]?.trim()) return `Question ${i + 1}: mark a filled-in option as correct.`;
  }
  return null;
}

/**
 * The question cards (surface-2 blocks). `removable` adds the ✕ the web's lesson
 * editor has (the add-lesson form has none); `explanationPlaceholder` differs
 * between the two web forms too.
 */
export function QuizBuilder({
  questions,
  onChange,
  removable,
  explanationPlaceholder,
}: {
  questions: QEdit[];
  onChange: (q: QEdit[]) => void;
  removable?: boolean;
  explanationPlaceholder: string;
}) {
  const update = (qi: number, patch: Partial<QEdit>) => onChange(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  return (
    <View style={{ gap: 8 }}>
      {questions.map((q, qi) => (
        <View key={qi} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="Question prompt"
                value={q.prompt}
                onChangeText={(t) => update(qi, { prompt: t })}
                accessibilityLabel={`Question ${qi + 1} prompt`}
              />
            </View>
            {removable ? (
              <Button
                title="✕"
                variant="danger"
                size="sm"
                style={{ borderWidth: 0, backgroundColor: "transparent" }}
                onPress={() => onChange(questions.filter((_, i) => i !== qi))}
                accessibilityLabel={`Remove question ${qi + 1}`}
              />
            ) : null}
          </View>
          {q.options.map((o, oi) => (
            <View key={oi} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <RadioDot selected={q.correctIdx === oi} onPress={() => update(qi, { correctIdx: oi })} label={`Correct answer: option ${oi + 1}`} />
              <View style={{ flex: 1 }}>
                <Field
                  placeholder={`Option ${oi + 1}`}
                  value={o}
                  onChangeText={(t) => update(qi, { options: q.options.map((y, yi) => (yi === oi ? t : y)) })}
                />
              </View>
            </View>
          ))}
          <Text
            variant="caption"
            color={colors.accent}
            onPress={() => update(qi, { options: [...q.options, ""] })}
            accessibilityRole="button"
            style={{ alignSelf: "flex-start", paddingVertical: 6 }}
          >
            + option
          </Text>
          <Field placeholder={explanationPlaceholder} value={q.explanation} onChangeText={(t) => update(qi, { explanation: t })} />
        </View>
      ))}
    </View>
  );
}
