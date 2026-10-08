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

/** Editable rows → the `questions` array the quiz routes accept. */
export function toPayload(questions: QEdit[]) {
  return questions.map((q) => ({
    prompt: q.prompt.trim(),
    options: q.options.filter((o) => o.trim()).map((text, i) => ({ id: letter(i), text: text.trim() })),
    correct: [letter(q.correctIdx)],
    explanation: q.explanation,
  }));
}

/** Mirrors the routes' zod rules so we can explain a problem before sending. */
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

export function QuizBuilder({ questions, onChange }: { questions: QEdit[]; onChange: (q: QEdit[]) => void }) {
  const update = (qi: number, patch: Partial<QEdit>) => onChange(questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  return (
    <View style={{ gap: 10 }}>
      {questions.map((q, qi) => (
        <View key={qi} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="caption" weight="semibold">Question {qi + 1}</Text>
            <Button
              title="Remove"
              variant="link"
              size="sm"
              onPress={() => onChange(questions.filter((_, i) => i !== qi))}
              accessibilityLabel={`Remove question ${qi + 1}`}
            />
          </View>
          <Field placeholder="Question prompt" value={q.prompt} onChangeText={(t) => update(qi, { prompt: t })} />
          <Text variant="caption">Tap the circle to mark the correct answer.</Text>
          {q.options.map((o, oi) => (
            <View key={oi} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <RadioDot
                selected={q.correctIdx === oi}
                onPress={() => update(qi, { correctIdx: oi })}
                label={`Mark option ${oi + 1} correct`}
              />
              <View style={{ flex: 1 }}>
                <Field
                  placeholder={`Option ${oi + 1}`}
                  value={o}
                  onChangeText={(t) => update(qi, { options: q.options.map((y, yi) => (yi === oi ? t : y)) })}
                />
              </View>
              {q.options.length > 2 ? (
                <Button
                  title="✕"
                  variant="link"
                  size="sm"
                  accessibilityLabel={`Remove option ${oi + 1}`}
                  onPress={() =>
                    update(qi, {
                      options: q.options.filter((_, yi) => yi !== oi),
                      correctIdx: q.correctIdx === oi ? 0 : q.correctIdx > oi ? q.correctIdx - 1 : q.correctIdx,
                    })
                  }
                />
              ) : null}
            </View>
          ))}
          <Button title="+ Option" variant="link" size="sm" onPress={() => update(qi, { options: [...q.options, ""] })} />
          <Field
            placeholder="Explanation (shown after answering)"
            value={q.explanation}
            onChangeText={(t) => update(qi, { explanation: t })}
          />
        </View>
      ))}
      <Button title="+ Question" variant="ghost" size="sm" onPress={() => onChange([...questions, emptyQuestion()])} />
    </View>
  );
}
