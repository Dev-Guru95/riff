// Lesson player — the web's /learn/[lessonId] (LessonPlayer.tsx): read → quiz →
// assignment → done, with the same completion rules and celebration copy.
//
// Data: GET /api/mobile/lessons/[id] (marks the lesson in_progress, as the page does).
// Writes: POST /api/lessons/:id/complete, POST /api/quizzes/:id/attempts,
//         POST /api/uploads (multipart) → POST /api/assignments/:id/submissions.

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";

import { post, upload } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { LessonText } from "@/components/Markdown";
import { pickDocument, pickFromCamera, pickFromLibrary } from "@/components/learning/attachments";
import { TrackReturnButton } from "@/components/learning/TrackReturnButton";
import { Button, Card, EmptyState, Field, QueryView, Screen, Text, useToast } from "@/components/ui";
import { absoluteUrl } from "@/config/env";
import { useApiMutation, useApiQuery, useInvalidate } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { LessonQuizQuestion, LessonResponse, ReviewResult, TrackReturnLink } from "@/types/api";

type Step = "read" | "quiz" | "assignment" | "done";
type LessonData = LessonResponse["lesson"];
type Quiz = NonNullable<LessonResponse["quiz"]>;
type Assignment = NonNullable<LessonResponse["assignment"]>;

type XpResult = {
  awarded: number;
  leveledUp?: boolean;
  level?: { levelName: string };
  newBadges?: { name: string; icon: string }[];
} | null;

type CompleteResponse = {
  xp?: XpResult;
  streak?: { currentLen: number } | null;
  courseProgress?: {
    rewards?: {
      trackBadge?: { name: string; icon: string } | null;
      certificate?: { title: string } | null;
    } | null;
  } | null;
};

type QuizResult = {
  score: number;
  passed: boolean;
  passThreshold: number;
  perQuestion: { questionId: string; isCorrect: boolean; explanation: string }[];
  xp?: XpResult;
  streak?: { currentLen: number } | null;
};

type SubmitResult = {
  submissionId: string;
  status: "reviewed" | "flagged" | string;
  review: ReviewResult;
  passed: boolean;
  flaggedForHumanReview: boolean;
  xp?: XpResult;
};

type UploadResult = { url: string; category: string; size: number };
type Attached = { url: string; category: string };

/** Everything that changes when XP or progress does. */
const PROGRESS_PATHS = [
  "/api/mobile/dashboard",
  "/api/mobile/courses",
  "/api/mobile/certificates",
  "/api/mobile/leaderboard",
  "/api/mobile/lessons/",
];

// Same celebration line as the web: XP, streak, level-up, new badges, and the
// track badge / certificate on the lesson that finishes a track.
function celebrate(data: CompleteResponse): string {
  const parts: string[] = [];
  const xp = data.xp?.awarded ?? 0;
  if (xp > 0) parts.push(`+${xp} XP`);
  if (data.streak?.currentLen) parts.push(`🔥 ${data.streak.currentLen}-day streak`);
  if (data.xp?.leveledUp && data.xp.level) parts.push(`⬆️ ${data.xp.level.levelName}!`);
  for (const b of data.xp?.newBadges ?? []) parts.push(`${b.icon} ${b.name}`);
  const rewards = data.courseProgress?.rewards;
  if (rewards?.trackBadge) parts.push(`${rewards.trackBadge.icon} ${rewards.trackBadge.name}`);
  if (rewards?.certificate) parts.push(`🎓 Program complete — certificate earned!`);
  return parts.join(" · ");
}

function scoreColor(s: number) {
  if (s >= 80) return colors.success;
  if (s >= 60) return colors.warning;
  return colors.brand2;
}

/** setTimeout that is cleared if the screen unmounts first. */
function useTimeouts() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
}

// ───────────────────────── screen ─────────────────────────

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApiQuery<LessonResponse>(id ? `/api/mobile/lessons/${encodeURIComponent(id)}` : null);
  const err = query.error;
  const locked = !query.data && err instanceof ApiError && err.status === 403 && err.body?.locked === true;
  const lockedSlug = locked && typeof (err as ApiError).body?.courseSlug === "string" ? ((err as ApiError).body!.courseSlug as string) : null;

  // The web page redirects a locked lesson to its course.
  useEffect(() => {
    if (lockedSlug) router.replace(`/courses/${lockedSlug}` as Href);
  }, [lockedSlug]);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: query.data?.lesson.courseTitle ?? "Lesson" }} />
      {locked ? (
        <EmptyState icon="lock" title="This lesson is locked" body={errorMessage(err)} />
      ) : (
        <QueryView query={query}>{(d) => <Player key={d.lesson.id} data={d} />}</QueryView>
      )}
    </Screen>
  );
}

function Player({ data }: { data: LessonResponse }) {
  const { lesson, quiz, assignment, nextLessonId, returnLink } = data;
  const toast = useToast();
  const invalidate = useInvalidate();
  const later = useTimeouts();
  // Skool teaches; Riff assesses. Tracks taught on Skool carry no prose, so land
  // straight on the task.
  const hasReading = lesson.content.trim().length > 0;
  const [step, setStep] = useState<Step>(hasReading ? "read" : quiz ? "quiz" : assignment ? "assignment" : "done");
  const completed = useRef(false);

  // Completing from the last quiz/assignment step when there was nothing to read
  // (the web's finish()). Idempotent server-side; best effort here.
  async function finish(msg: string) {
    if (!completed.current) {
      completed.current = true;
      try {
        await post(`/api/lessons/${lesson.id}/complete`);
        void invalidate(...PROGRESS_PATHS);
      } catch {
        // Never let a progress write swallow the artist's result.
      }
    }
    toast(msg);
    setStep("done");
  }

  return (
    <View>
      <Pressable
        onPress={() => router.dismissTo(`/courses/${lesson.courseSlug}` as Href)}
        accessibilityRole="link"
        accessibilityLabel={`Back to ${lesson.courseTitle}`}
        hitSlop={8}
        style={{ alignSelf: "flex-start" }}
      >
        <Text variant="small">← {lesson.courseTitle}</Text>
      </Pressable>

      <Stepper step={step} hasReading={hasReading} hasQuiz={!!quiz} hasAssignment={!!assignment} />

      {step === "read" ? (
        <ReadStep
          lesson={lesson}
          onComplete={(msg) => {
            completed.current = true; // ReadStep already POSTed the completion
            toast(msg);
            setStep(quiz ? "quiz" : assignment ? "assignment" : "done");
          }}
        />
      ) : null}

      {step === "quiz" && quiz ? (
        <QuizStep
          quiz={quiz}
          later={later}
          onPass={(msg) => {
            if (assignment) {
              toast(msg);
              setStep("assignment");
            } else void finish(msg);
          }}
        />
      ) : null}

      {step === "assignment" && assignment ? (
        <AssignmentStep assignment={assignment} latest={data.latestSubmission} later={later} onDone={(msg) => void finish(msg)} />
      ) : null}

      {step === "done" ? <DoneStep nextLessonId={nextLessonId} courseSlug={lesson.courseSlug} returnLink={returnLink} /> : null}
    </View>
  );
}

function Stepper({ step, hasReading, hasQuiz, hasAssignment }: { step: Step; hasReading: boolean; hasQuiz: boolean; hasAssignment: boolean }) {
  const steps: { key: Step; label: string }[] = hasReading ? [{ key: "read", label: "Lesson" }] : [];
  if (hasQuiz) steps.push({ key: "quiz", label: "Quiz" });
  if (hasAssignment) steps.push({ key: "assignment", label: "Assignment" });
  steps.push({ key: "done", label: "Done" });
  const order: Step[] = ["read", "quiz", "assignment", "done"];
  const cur = order.indexOf(step);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 20 }} accessibilityLabel={`Step: ${steps.find((s) => s.key === step)?.label ?? ""}`}>
      {steps.map((s) => {
        const active = order.indexOf(s.key) <= cur;
        return (
          <View key={s.key} style={[st.stepChip, active && { backgroundColor: colors.brand }]}>
            <Text variant="caption" color={active ? colors.white : colors.muted}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ───────────────────────── read ─────────────────────────

function ReadStep({ lesson, onComplete }: { lesson: LessonData; onComplete: (msg: string) => void }) {
  const complete = useApiMutation<CompleteResponse>({
    invalidates: PROGRESS_PATHS,
    onSuccess: (d) => onComplete(celebrate(d) || "Lesson complete"),
  });
  return (
    <Card style={{ padding: 28 }}>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: 16 }}>{lesson.title}</Text>
      <LessonText content={lesson.content} />
      <Button
        style={{ marginTop: 24 }}
        title={complete.isPending ? "Saving…" : lesson.alreadyCompleted ? "Continue" : `Complete lesson · +${lesson.xpReward} XP`}
        fullWidth
        loading={complete.isPending}
        onPress={() => complete.mutate({ path: `/api/lessons/${lesson.id}/complete` })}
      />
    </Card>
  );
}

// ───────────────────────── quiz ─────────────────────────

function QuizStep({ quiz, onPass, later }: { quiz: Quiz; onPass: (msg: string) => void; later: (fn: () => void, ms: number) => void }) {
  const invalidate = useInvalidate();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const attempt = useApiMutation<QuizResult>({
    onSuccess: (d) => {
      setResult(d);
      if (d.passed) {
        void invalidate(...PROGRESS_PATHS);
        const xp = d.xp?.awarded ?? 0;
        later(() => onPass(xp > 0 ? `Passed! +${xp} XP` : "Quiz passed"), 1200);
      }
    },
  });

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  function choose(q: LessonQuizQuestion, optionId: string) {
    setAnswers((a) => {
      if (q.type !== "multi") return { ...a, [q.id]: [optionId] };
      const cur = a[q.id] ?? [];
      return { ...a, [q.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
    });
  }

  return (
    <Card style={{ gap: 24, padding: 28 }}>
      <Text style={st.h2} accessibilityRole="header">Quick quiz</Text>
      <Text variant="small">Score {quiz.passThreshold}%+ to pass and earn XP.</Text>
      {quiz.questions.map((q, qi) => {
        const verdict = result?.perQuestion.find((p) => p.questionId === q.id);
        const multi = q.type === "multi";
        return (
          <View key={q.id} style={{ gap: 8 }}>
            <Text weight="medium" style={{ fontSize: 16, lineHeight: 24 }}>
              {qi + 1}. {q.prompt}
            </Text>
            {multi ? <Text variant="caption">Select all that apply.</Text> : null}
            {q.options.map((o) => {
              const selected = !!answers[q.id]?.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  disabled={!!result}
                  onPress={() => choose(q, o.id)}
                  accessibilityRole={multi ? "checkbox" : "radio"}
                  accessibilityState={{ checked: selected, disabled: !!result }}
                  style={({ pressed }) => [st.option, selected && st.optionSelected, pressed && !result && { borderColor: colors.muted }]}
                >
                  <Text style={{ flex: 1 }}>{o.text}</Text>
                </Pressable>
              );
            })}
            {verdict ? (
              <Text variant="caption" color={verdict.isCorrect ? colors.success : colors.brand2} accessibilityLiveRegion="polite">
                {verdict.isCorrect ? "✓ Correct. " : "✗ Not quite. "}
                {verdict.explanation}
              </Text>
            ) : null}
          </View>
        );
      })}

      {!result ? (
        <Button
          title={attempt.isPending ? "Checking…" : "Submit answers"}
          fullWidth
          loading={attempt.isPending}
          disabled={!allAnswered}
          onPress={() => attempt.mutate({ path: `/api/quizzes/${quiz.id}/attempts`, body: { answers } })}
        />
      ) : result.passed ? (
        <Text weight="semibold" color={colors.success} style={{ textAlign: "center", fontSize: 16, lineHeight: 24 }} accessibilityLiveRegion="polite">
          🎉 Passed with {result.score}%!
        </Text>
      ) : (
        <View style={{ alignItems: "center", gap: 12 }}>
          <Text weight="medium" color={colors.brand2} style={{ textAlign: "center", fontSize: 16, lineHeight: 24 }} accessibilityLiveRegion="polite">
            Scored {result.score}%. Need {quiz.passThreshold}%. Review and retry.
          </Text>
          <Button
            title="Try again"
            variant="ghost"
            style={{ alignSelf: "center" }}
            onPress={() => {
              setResult(null);
              setAnswers({});
            }}
          />
        </View>
      )}
    </Card>
  );
}

// ───────────────────────── assignment ─────────────────────────

function ReviewList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold" color={color} style={{ textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <Text color={color}>•</Text>
          <Text style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function ScoreHeader({ score, title, subtitle }: { score: number; title: string; subtitle: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }} accessible accessibilityLabel={`AI review score ${score}. ${subtitle}`}>
      <Text style={{ fontSize: 36, lineHeight: 40, fontFamily: fonts.bold, color: scoreColor(score) }}>{score}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24 }}>AI Review · {title}</Text>
        <Text variant="caption">{subtitle}</Text>
      </View>
    </View>
  );
}

function AssignmentStep({
  assignment,
  latest,
  onDone,
  later,
}: {
  assignment: Assignment;
  latest: LessonResponse["latestSubmission"];
  onDone: (msg: string) => void;
  later: (fn: () => void, ms: number) => void;
}) {
  const invalidate = useInvalidate();
  // Reopen with the artist's own work already in place (the web loads the same
  // data from GET /api/assignments/:id/submissions; the lesson endpoint includes it).
  const [text, setText] = useState(latest?.textContent ?? "");
  const [link, setLink] = useState(latest?.externalLink ?? "");
  const [uploads, setUploads] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ submittedAt: string; status: string } | null>(
    latest ? { submittedAt: latest.submittedAt, status: latest.status } : null,
  );
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState<SubmitResult | null>(null);

  const submit = useMutation<SubmitResult, unknown, Record<string, unknown>>({
    mutationFn: (body) => post<SubmitResult>(`/api/assignments/${assignment.id}/submissions`, body),
    onSuccess: (d) => {
      setReview(d);
      setSaved({ submittedAt: new Date().toISOString(), status: d.status ?? "reviewed" });
      setEditing(false);
      void invalidate(...PROGRESS_PATHS);
      const xp = d.xp?.awarded ?? 0;
      later(() => onDone(xp > 0 ? `Reviewed! +${xp} XP` : "Response saved"), 800);
    },
    // The web shows submit errors inline under the form.
    onError: (e) => setError(errorMessage(e)),
  });

  async function attach(pick: () => Promise<Awaited<ReturnType<typeof pickDocument>>>) {
    setError(null);
    let file;
    try {
      file = await pick();
    } catch {
      setError("Couldn't open the picker. Please try again.");
      return;
    }
    if (!file) return;
    setUploading(true);
    try {
      const res = await upload<UploadResult>("/api/uploads", file);
      setUploads((u) => [...u, { url: res.url, category: res.category }]);
    } catch (e) {
      setError(errorMessage(e) || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // The web's single "📎 Attach file" opens the OS picker, which on a phone
  // offers camera / photos / files; natively those are three pickers.
  function chooseSource() {
    Alert.alert("Attach file", "image, audio, video, or PDF (max 25MB)", [
      { text: "Take photo", onPress: () => void attach(pickFromCamera) },
      { text: "Photo or video", onPress: () => void attach(pickFromLibrary) },
      { text: "Files", onPress: () => void attach(pickDocument) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function send() {
    setError(null);
    const artifactType = uploads[0]?.category ?? (link ? "link" : "text");
    const body: Record<string, unknown> = { artifactType };
    if (text) body.textContent = text;
    if (link) body.externalLink = link.trim();
    if (uploads.length) body.artifactUrls = uploads.map((u) => absoluteUrl(u.url));
    submit.mutate(body);
  }

  if (review) {
    const r = review.review;
    return (
      <Card style={{ gap: 20, padding: 28 }}>
        <ScoreHeader
          score={r.score}
          title={assignment.title}
          subtitle={review.flaggedForHumanReview ? "Flagged for human review" : review.passed ? "Passed" : "Below passing — revise & resubmit"}
        />
        <Text color={colors.success}>✓ Response saved · ✓ Action step completed</Text>
        <ReviewList title="Strengths" items={r.strengths} color={colors.success} />
        <ReviewList title="Weaknesses" items={r.weaknesses} color={colors.brand2} />
        <ReviewList title="Recommendations" items={r.recommendations} color={colors.accent} />
        <ReviewList title="Next actions" items={r.nextActions} color={colors.warning} />
        <Button
          title="Edit my response"
          variant="ghost"
          size="sm"
          fullWidth
          onPress={() => {
            setReview(null);
            setEditing(true);
          }}
        />
      </Card>
    );
  }

  // Saved and not being edited: show the work back instead of an input.
  if (saved && !editing) {
    return (
      <Card style={{ gap: 16, padding: 28 }}>
        <Text style={st.h2} accessibilityRole="header">{assignment.title}</Text>
        <Text variant="small">{assignment.instructions}</Text>
        <Text color={colors.success}>✓ Response saved · ✓ Action step completed</Text>
        <View style={st.savedBox}>
          {text ? <Text selectable>{text}</Text> : <Text variant="small">(no written response)</Text>}
        </View>
        {link ? (
          <Text color={colors.accent} accessibilityRole="link" onPress={() => void openLink(link)}>
            {link}
          </Text>
        ) : null}
        <Text variant="caption">Saved {new Date(saved.submittedAt).toLocaleDateString()} · stored on your account.</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button title="Edit response" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(true)} />
          <Button title="Continue →" style={{ flex: 1 }} onPress={() => onDone("Action step complete")} />
        </View>
      </Card>
    );
  }

  const busy = submit.isPending;
  return (
    <Card style={{ gap: 16, padding: 28 }}>
      <Text style={st.h2} accessibilityRole="header">{assignment.title}</Text>
      <Text variant="small">{assignment.instructions}</Text>
      <Field
        accessibilityLabel="Your response"
        placeholder="Write your response here — it saves to your account, so you can come back and edit it."
        value={text}
        onChangeText={setText}
        multiline
        style={{ minHeight: 128 }}
      />
      <Field
        accessibilityLabel="Optional link"
        placeholder="Optional: link to a post / artwork / track"
        value={link}
        onChangeText={setLink}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* File upload: artwork / audio / video / PDF */}
      <View style={st.dropzone}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Button
            title={uploading ? "Uploading…" : "📎 Attach file"}
            variant="ghost"
            size="sm"
            disabled={uploading || busy}
            onPress={chooseSource}
            accessibilityLabel="Attach file"
          />
          <Text variant="caption" style={{ flex: 1, minWidth: 140 }}>image, audio, video, or PDF (max 25MB)</Text>
        </View>
        {uploads.length > 0 ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            {uploads.map((u, i) => (
              <View key={`${u.url}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="caption" color={colors.success}>✓ {u.category} attached</Text>
                <Pressable
                  onPress={() => setUploads((arr) => arr.filter((_, idx) => idx !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${u.category} attachment`}
                  hitSlop={12}
                >
                  <Text variant="caption">remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {error ? <Text color={colors.brand2} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {saved ? <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setEditing(false)} /> : null}
        <Button
          title={busy ? "Saving & reviewing…" : saved ? "Save changes" : "Save response"}
          style={{ flex: 1 }}
          disabled={busy || uploading || (!text && !link && uploads.length === 0)}
          onPress={send}
        />
      </View>
    </Card>
  );
}

// ───────────────────────── done ─────────────────────────

function DoneStep({ nextLessonId, courseSlug, returnLink }: { nextLessonId: string | null; courseSlug: string; returnLink: TrackReturnLink | null }) {
  // Last lesson of the track with a return destination: the return link becomes
  // the primary call to action, so the Skool → Riff → Skool cycle continues.
  const trackDone = !nextLessonId && !!returnLink;
  return (
    <Card style={{ alignItems: "center", padding: 32 }}>
      <Text style={{ fontSize: 48, lineHeight: 56, marginBottom: 12 }}>{trackDone ? "🏁" : "🎉"}</Text>
      <Text variant="title" style={{ textAlign: "center", marginBottom: 8 }} accessibilityRole="header">
        {trackDone ? "Track complete!" : "Lesson complete!"}
      </Text>
      <Text color={colors.muted} style={{ textAlign: "center", marginBottom: 24, fontSize: 16, lineHeight: 24 }}>
        {trackDone
          ? "You've finished every question in this track. Head back to pick up the next one."
          : "You earned XP and kept your streak alive."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
        {nextLessonId ? (
          <Button title="Next lesson →" onPress={() => router.replace(`/learn/${nextLessonId}` as Href)} />
        ) : returnLink ? (
          <TrackReturnButton link={returnLink} />
        ) : (
          <Button title="Back to course" onPress={() => router.dismissTo(`/courses/${courseSlug}` as Href)} />
        )}
        {trackDone ? <Button title="Back to track" variant="ghost" onPress={() => router.dismissTo(`/courses/${courseSlug}` as Href)} /> : null}
        <Button title="Dashboard" variant="ghost" onPress={() => router.dismissTo("/" as Href)} />
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  stepChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TOUCH,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.brand, backgroundColor: colors.surface2 },
  savedBox: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  dropzone: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.md, padding: 12 },
  h2: { fontSize: 20, lineHeight: 28, fontFamily: fonts.bold, color: colors.foreground },
});
