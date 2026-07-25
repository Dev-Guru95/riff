import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateCourseForm, PublishToggle } from "./CourseAdminClient";

export default async function AdminCourses() {
  const courses = await prisma.course.findMany({
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { modules: true } }, modules: { include: { _count: { select: { lessons: true } } } } },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
      </div>

      <CreateCourseForm />

      <div className="space-y-3">
        {courses.map((c) => {
          const lessons = c.modules.reduce((n, m) => n + m._count.lessons, 0);
          return (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/courses/${c.id}`} className="font-semibold hover:text-[var(--accent)]">{c.title}</Link>
                  <span className="text-xs text-[var(--muted)]">/{c.slug}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)]">{c.level}</span>
                  <span className="text-xs text-[var(--muted)]">v{c.version}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">{c._count.modules} modules · {lessons} lessons</div>
              </div>
              <div className="flex items-center gap-3">
                <PublishToggle id={c.id} isPublished={c.isPublished} />
                <Link href={`/admin/courses/${c.id}`} className="btn btn-ghost py-1.5 px-3 text-xs">Manage</Link>
              </div>
            </div>
          );
        })}
        {courses.length === 0 && <p className="text-[var(--muted)] text-sm">No courses yet. Create one above.</p>}
      </div>
    </div>
  );
}
