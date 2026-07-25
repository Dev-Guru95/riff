import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AddModuleForm, AddLessonForm } from "./LessonBuilder";
import { ModuleHeader, LessonEditor } from "./EditClient";

export default async function ManageCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
              assignment: true,
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← All courses</Link>
      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="text-sm text-[var(--muted)]">/{course.slug} · {course.isPublished ? "Published" : "Draft"} · v{course.version}</p>
      </div>

      <div className="space-y-5">
        {course.modules.map((m, mi) => (
          <section key={m.id} className="card p-5">
            <ModuleHeader id={m.id} index={mi} title={m.title} lessonCount={m.lessons.length} />
            <ul className="space-y-2 my-4">
              {m.lessons.map((l, li) => (
                <li key={l.id}>
                  <LessonEditor
                    index={li}
                    lesson={{
                      id: l.id,
                      title: l.title,
                      content: l.content,
                      xpReward: l.xpReward,
                      estMinutes: l.estMinutes,
                      quiz: l.quiz
                        ? {
                            passThreshold: l.quiz.passThreshold,
                            questions: l.quiz.questions.map((q) => ({
                              prompt: q.prompt,
                              options: JSON.parse(q.options) as { id: string; text: string }[],
                              correct: JSON.parse(q.correct) as string[],
                              explanation: q.explanation,
                            })),
                          }
                        : null,
                      assignment: l.assignment
                        ? { title: l.assignment.title, instructions: l.assignment.instructions }
                        : null,
                    }}
                  />
                </li>
              ))}
              {m.lessons.length === 0 && <li className="text-xs text-[var(--muted)]">No lessons yet.</li>}
            </ul>
            <AddLessonForm moduleId={m.id} />
          </section>
        ))}
      </div>

      <AddModuleForm courseId={course.id} />
    </div>
  );
}
