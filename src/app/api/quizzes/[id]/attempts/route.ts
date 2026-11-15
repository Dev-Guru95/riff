import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAchievement } from "@/lib/events";
import { completeCourseIfQuizzesPassed } from "@/lib/enrollment";
import type { SharePayload } from "@/lib/share";
import { track } from "@/lib/analytics";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({
  // map of questionId -> array of selected option ids
  answers: z.record(z.string(), z.array(z.string())),
});

export const POST = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const { id } = await params;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!quiz) return fail("Quiz not found", 404);

  // Score: each question all-or-nothing (selected set === correct set).
  let correctCount = 0;
  const perQuestion = quiz.questions.map((q) => {
    const correct = new Set<string>(JSON.parse(q.correct));
    const given = new Set<string>(data.answers[q.id] ?? []);
    const isCorrect =
      correct.size === given.size && [...correct].every((c) => given.has(c));
    if (isCorrect) correctCount++;
    return { questionId: q.id, isCorrect, explanation: q.explanation };
  });

  const total = quiz.questions.length || 1;
  const score = Math.round((correctCount / total) * 100);
  const passed = score >= quiz.passThreshold;

  const priorAttempts = await prisma.quizAttempt.count({ where: { userId: session.id, quizId: id } });
  await prisma.quizAttempt.create({
    data: {
      userId: session.id,
      quizId: id,
      score,
      passed,
      answers: JSON.stringify(data.answers),
      attemptNo: priorAttempts + 1,
    },
  });

  let xp = null;
  let streak = null;
  let shares: SharePayload[] | undefined;
  let courseRewards: Awaited<ReturnType<typeof completeCourseIfQuizzesPassed>> = null;
  if (passed) {
    // Base + bonus for beating the threshold. Idempotent on first pass only.
    const bonus = Math.round(0.5 * Math.max(0, score - quiz.passThreshold));
    const result = await recordAchievement({ userId: session.id, xp: quiz.xpReward + bonus, source: "quiz", refId: id });
    xp = result.xp;
    streak = result.streak;
    shares = result.shares;

    // Passing the track's quiz is what completes the track. Artists learn on
    // Skool and only test here, so waiting for every lesson to be opened in
    // Riff left the program certificate stuck at 0 tracks. Idempotent.
    const courseId = quiz.lesson.module.courseId;
    if (courseId) {
      courseRewards = await completeCourseIfQuizzesPassed(session.id, courseId);
    }
  }
  await track(passed ? "quiz_pass" : "quiz_fail", session.id, { quizId: id, score });

  return ok({ score, passed, passThreshold: quiz.passThreshold, perQuestion, xp, streak, shares, courseRewards });
});
