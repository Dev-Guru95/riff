import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, Chip } from "@/components/ui";
import { CreateCourseForm, PublishToggle } from "./CourseAdminClient";

export default async function AdminCourses() {
  const courses = await prisma.course.findMany({
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { modules: true } }, modules: { include: { _count: { select: { lessons: true } } } } },
  });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Course"
        subtitle="Create, import, and publish the tracks artists work through"
        action={<CreateCourseForm />}
      />

      <div className="space-y-2.5">
        {courses.map((c) => {
          const lessons = c.modules.reduce((n, m) => n + m._count.lessons, 0);
          return (
            <div key={c.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/courses/${c.id}`} className="font-semibold hover:text-[var(--brand)] transition">
                    {c.title}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">/{c.slug}</span>
                  <Chip>{c.level}</Chip>
                  <span className="text-xs text-[var(--muted)]">v{c.version}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {c._count.modules} modules &middot; {lessons} lessons
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <PublishToggle id={c.id} isPublished={c.isPublished} />
                <Link href={`/admin/courses/${c.id}`} className="btn btn-ghost py-1.5 px-3 text-xs">
                  Manage
                </Link>
              </div>
            </div>
          );
        })}
        {courses.length === 0 && (
          <EmptyState
            icon="graduation"
            title="No courses yet"
            hint="Use New course to start one from scratch, or import an existing outline."
          />
        )}
      </div>
    </div>
  );
}
