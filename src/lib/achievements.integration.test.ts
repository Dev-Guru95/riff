import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";

// Integration tests exercise the real awarding chain against a real Postgres
// database in a throwaway schema (never the app's own data). Point
// TEST_DATABASE_URL at any Postgres instance — the suite creates a uniquely
// named schema, pushes the Prisma schema into it, and drops it on the way out,
// so concurrent runs never collide. Without TEST_DATABASE_URL the suite skips
// itself, keeping `pnpm test` green on a bare checkout with no database.

const BASE_URL = process.env.TEST_DATABASE_URL ?? "";
const HAS_DB = /^postgres(ql)?:\/\//.test(BASE_URL);
const SCHEMA = `riff_test_${process.pid.toString(36)}_${Date.now().toString(36)}`;

function withSchema(url: string, schema: string) {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let recomputeEnrollmentProgress: any;
let backfillAchievements: any;
let isProgramComplete: any;
let PROGRAM_KEY: string;
let PROGRAM_BADGE_KEY: string;
let trackBadgeKey: (slug: string) => string;

let courseSeq = 0;

async function seedProgramBadge() {
  await prisma.badge.upsert({
    where: { key: PROGRAM_BADGE_KEY },
    create: { key: PROGRAM_BADGE_KEY, name: "Program Graduate", description: "Finish everything.", icon: "🎓", tier: "platinum" },
    update: {},
  });
}

async function reset() {
  // Child-first delete order (no cascade reliance across every table).
  await prisma.certificate.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.user.deleteMany();
  await seedProgramBadge();
}

async function makeUser() {
  return prisma.user.create({ data: { email: `u${Math.random()}@t.dev`, passwordHash: "x" } });
}

async function makeCourse(title: string) {
  const slug = `course-${courseSeq++}`;
  const course = await prisma.course.create({
    data: { slug, title, description: "d", isPublished: true, orderIndex: courseSeq },
  });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "M", orderIndex: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: "L", orderIndex: 0 } });
  return { course, lessons: [lesson] };
}

async function finishCourse(userId: string, course: any, lessons: any[]) {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id },
    update: {},
  });
  for (const l of lessons) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: l.id } },
      create: { userId, lessonId: l.id, status: "completed", completedAt: new Date() },
      update: { status: "completed", completedAt: new Date() },
    });
  }
  return recomputeEnrollmentProgress(userId, course.id);
}

function badgeCount(userId: string, key: string) {
  return prisma.userBadge.count({ where: { userId, badge: { key } } });
}

beforeAll(async () => {
  if (!HAS_DB) return;
  const url = withSchema(BASE_URL, SCHEMA);
  process.env.DATABASE_URL = url;
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  ({ prisma } = await import("./prisma"));
  ({ recomputeEnrollmentProgress } = await import("./enrollment"));
  ({ backfillAchievements } = await import("./achievements"));
  ({ isProgramComplete } = await import("./certificates"));
  ({ PROGRAM_KEY, PROGRAM_BADGE_KEY, trackBadgeKey } = await import("./constants"));
}, 180_000);

afterAll(async () => {
  if (!HAS_DB) return;
  await prisma?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await prisma?.$disconnect();
});

beforeEach(async () => {
  if (!HAS_DB) return;
  await reset();
});

describe.skipIf(!HAS_DB)("track completion badges", () => {
  it("awards the correct track badge when a course is completed", async () => {
    const user = await makeUser();
    const { course, lessons } = await makeCourse("Marketing Foundations");

    const result = await finishCourse(user.id, course, lessons);

    expect(result.completed).toBe(true);
    expect(result.rewards.trackBadge).not.toBeNull();
    expect(await badgeCount(user.id, trackBadgeKey(course.slug))).toBe(1);
  });

  it("cannot award the same track badge twice", async () => {
    const user = await makeUser();
    const { course, lessons } = await makeCourse("Marketing Foundations");

    const first = await finishCourse(user.id, course, lessons);
    const second = await finishCourse(user.id, course, lessons); // re-complete

    expect(first.rewards.trackBadge).not.toBeNull(); // newly awarded
    expect(second.rewards.trackBadge).toBeNull(); // idempotent — nothing new
    expect(await badgeCount(user.id, trackBadgeKey(course.slug))).toBe(1);
  });

  it("does not issue the certificate until every track is complete", async () => {
    const user = await makeUser();
    const a = await makeCourse("Track A");
    await makeCourse("Track B"); // published but not completed

    const result = await finishCourse(user.id, a.course, a.lessons);

    expect(result.rewards.trackBadge).not.toBeNull();
    expect(result.rewards.certificate).toBeNull();
    expect(await isProgramComplete(user.id)).toBe(false);
    expect(await prisma.certificate.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe.skipIf(!HAS_DB)("program certificate", () => {
  it("issues the certificate + capstone badge when the whole program is complete", async () => {
    const user = await makeUser();
    const a = await makeCourse("Track A");
    const b = await makeCourse("Track B");

    await finishCourse(user.id, a.course, a.lessons);
    const result = await finishCourse(user.id, b.course, b.lessons);

    expect(await isProgramComplete(user.id)).toBe(true);
    expect(result.rewards.certificate).not.toBeNull();
    expect(await prisma.certificate.count({ where: { userId: user.id, programKey: PROGRAM_KEY } })).toBe(1);
    expect(await badgeCount(user.id, PROGRAM_BADGE_KEY)).toBe(1);
  });

  it("is idempotent — finishing again keeps a single certificate", async () => {
    const user = await makeUser();
    const a = await makeCourse("Track A");

    await finishCourse(user.id, a.course, a.lessons); // single-course program → complete
    const again = await finishCourse(user.id, a.course, a.lessons);

    expect(again.rewards.certificate).toBeNull(); // not re-issued
    expect(await prisma.certificate.count({ where: { userId: user.id } })).toBe(1);
    expect(await badgeCount(user.id, PROGRAM_BADGE_KEY)).toBe(1);
  });
});

describe.skipIf(!HAS_DB)("backfill — previously completed tracks", () => {
  it("grants badges + certificate for courses completed before the feature existed", async () => {
    const user = await makeUser();
    const { course, lessons } = await makeCourse("Legacy Track");

    // Simulate a pre-feature completion: enrollment + progress marked done, but
    // onCourseCompleted was never called, so no badge/cert exists yet.
    await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id, completedAt: new Date(), progressPct: 100 } });
    for (const l of lessons) {
      await prisma.lessonProgress.create({ data: { userId: user.id, lessonId: l.id, status: "completed", completedAt: new Date() } });
    }
    expect(await badgeCount(user.id, trackBadgeKey(course.slug))).toBe(0);

    const count = await backfillAchievements(user.id);

    expect(count).toBeGreaterThanOrEqual(1);
    expect(await badgeCount(user.id, trackBadgeKey(course.slug))).toBe(1);
    expect(await prisma.certificate.count({ where: { userId: user.id } })).toBe(1); // single-course program
  });
});
