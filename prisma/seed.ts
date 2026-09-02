import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { trackBadgeKey, PROGRAM_BADGE_KEY } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Riff...");

  // ---- Badges ----
  // Journey/milestone badges + the program capstone. Track-completion badges are
  // seeded separately below (one per published course) so they show on the badge
  // wall before they're earned.
  const badges = [
    { key: "first_steps", name: "First Steps", description: "Complete your first lesson.", icon: "👣", tier: "bronze" },
    { key: "quiz_whiz", name: "Quiz Whiz", description: "Pass 3 quizzes.", icon: "🧠", tier: "silver" },
    { key: "first_submission", name: "On The Record", description: "Get your first assignment reviewed.", icon: "🎙️", tier: "bronze" },
    { key: "streak_7", name: "Consistency King", description: "Reach a 7-day streak.", icon: "🔥", tier: "gold" },
    { key: "mission_marathon", name: "Mission Marathon", description: "Complete 10 missions.", icon: "🏃", tier: "platinum" },
    { key: PROGRAM_BADGE_KEY, name: "Program Graduate", description: "Complete the entire Soundring Artist Program.", icon: "🎓", tier: "platinum" },
  ];
  for (const b of badges) {
    await prisma.badge.upsert({ where: { key: b.key }, create: b, update: b });
  }

  // ---- Missions ----
  const missions = [
    { title: "Define Your Brand Pillars", description: "Write 3 words that describe your artist brand and explain each.", category: "branding", xpReward: 120 },
    { title: "7-Day Posting Challenge", description: "Post once a day for 7 days on your main platform.", category: "content", xpReward: 200 },
    { title: "Engage 10 Fans", description: "Reply meaningfully to 10 comments or DMs this week.", category: "engagement", xpReward: 100 },
  ];
  for (const m of missions) {
    const exists = await prisma.mission.findFirst({ where: { title: m.title } });
    if (!exists) await prisma.mission.create({ data: m });
  }

  // ---- Course: Music Marketing Foundations ----
  const existing = await prisma.course.findUnique({ where: { slug: "marketing-foundations" } });
  if (!existing) {
    const course = await prisma.course.create({
      data: {
        slug: "marketing-foundations",
        title: "Music Marketing Foundations",
        description: "Build the brand, content, and release habits that grow an independent artist career.",
        level: "beginner",
        isPublished: true,
        orderIndex: 0,
      },
    });

    const moduleData = [
      {
        title: "Branding Basics",
        lessons: [
          {
            title: "What Is an Artist Brand?",
            content:
              "Your brand is the promise fans feel before they hit play. It is your story, look, and tone — consistent across every platform. In this lesson you'll learn the 3 pillars of an artist brand: **Identity** (who you are), **Aesthetic** (how you look), and **Voice** (how you speak).",
            quiz: {
              questions: [
                {
                  prompt: "Which best describes an artist brand?",
                  options: [{ id: "a", text: "Only your logo" }, { id: "b", text: "The consistent promise fans feel about you" }, { id: "c", text: "Your number of followers" }],
                  correct: ["b"],
                  explanation: "A brand is the consistent promise/identity fans associate with you — not just a logo or a follower count.",
                },
                {
                  prompt: "How many brand pillars were introduced?",
                  options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "5" }],
                  correct: ["b"],
                  explanation: "Identity, Aesthetic, and Voice.",
                },
              ],
            },
            assignment: {
              title: "Draft Your Brand Statement",
              instructions: "Write a 2-3 sentence brand statement covering your identity, aesthetic, and voice. Optionally link an example post that reflects it.",
              rubric: [
                { criterion: "Clarity of identity", weight: 0.4 },
                { criterion: "Aesthetic & voice consistency", weight: 0.3 },
                { criterion: "Actionability", weight: 0.3 },
              ],
            },
          },
          {
            title: "Visual Consistency",
            content:
              "A recognizable grid beats a random feed. Pick a **color palette** (2-3 colors), a **font**, and a **photo style**, then apply them everywhere. Consistency is what turns a scroll into recognition.",
            quiz: {
              questions: [
                {
                  prompt: "How many core colors should a starter palette have?",
                  options: [{ id: "a", text: "1" }, { id: "b", text: "2-3" }, { id: "c", text: "8+" }],
                  correct: ["b"],
                  explanation: "2-3 colors keep your look recognizable without being chaotic.",
                },
              ],
            },
          },
        ],
      },
      {
        title: "Content & Growth",
        lessons: [
          {
            title: "The Content Cadence",
            content:
              "Algorithms reward consistency. Decide a realistic cadence (e.g. 3 posts/week) and batch-create so you never miss. Track posting consistency — it's one of your audit scores.",
            quiz: {
              questions: [
                {
                  prompt: "Why does cadence matter?",
                  options: [{ id: "a", text: "Algorithms reward consistency" }, { id: "b", text: "It doesn't" }, { id: "c", text: "Only follower count matters" }],
                  correct: ["a"],
                  explanation: "Consistent posting signals reliability to both fans and algorithms.",
                },
              ],
            },
            assignment: {
              title: "Plan Your Week of Content",
              instructions: "Outline 3 posts for the coming week: hook, format, and call-to-action for each.",
              rubric: [
                { criterion: "Realistic cadence", weight: 0.4 },
                { criterion: "Clear hooks & CTAs", weight: 0.6 },
              ],
            },
          },
        ],
      },
    ];

    for (let mi = 0; mi < moduleData.length; mi++) {
      const m = moduleData[mi];
      const mod = await prisma.module.create({
        data: { courseId: course.id, title: m.title, orderIndex: mi },
      });
      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li];
        const lesson = await prisma.lesson.create({
          data: { moduleId: mod.id, title: l.title, orderIndex: li, content: l.content, estMinutes: 6, xpReward: 20 },
        });
        if (l.quiz) {
          const quiz = await prisma.quiz.create({ data: { lessonId: lesson.id, passThreshold: 80, xpReward: 30 } });
          for (let qi = 0; qi < l.quiz.questions.length; qi++) {
            const q = l.quiz.questions[qi];
            await prisma.quizQuestion.create({
              data: {
                quizId: quiz.id,
                type: "single",
                prompt: q.prompt,
                options: JSON.stringify(q.options),
                correct: JSON.stringify(q.correct),
                explanation: q.explanation,
                orderIndex: qi,
              },
            });
          }
        }
        if (l.assignment) {
          await prisma.assignment.create({
            data: {
              lessonId: lesson.id,
              title: l.assignment.title,
              instructions: l.assignment.instructions,
              rubric: JSON.stringify(l.assignment.rubric),
              acceptedTypes: JSON.stringify(["text", "link", "image"]),
              xpReward: 60,
              minPassingScore: 60,
            },
          });
        }
      }
    }
  }

  // ---- Demo user ----
  // Gated: these credentials are hardcoded below and this repo is public, so an
  // unguarded seed would put a known-password admin on a live URL. Opt in with
  // SEED_DEMO_USERS=true for local development only; use prisma/create-admin.ts
  // (env-supplied password) to make a real admin on a deployed environment.
  const seedDemoUsers = process.env.SEED_DEMO_USERS === "true";
  if (!seedDemoUsers) {
    console.log("Skipping demo/admin users (set SEED_DEMO_USERS=true to create them).");
  }

  const demoEmail = "demo@riff.app";
  const demoExists = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (seedDemoUsers && !demoExists) {
    const user = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: await bcrypt.hash("password123", 10),
        countryCode: "US",
        profile: {
          create: { stageName: "Demo Artist", genres: JSON.stringify(["pop", "indie"]), careerStage: "beginner", audienceSize: 350 },
        },
        level: { create: {} },
        streak: { create: {} },
      },
    });
    const course = await prisma.course.findUnique({ where: { slug: "marketing-foundations" } });
    if (course) await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
    console.log("Demo user: demo@riff.app / password123");
  }

  // ---- Admin user ----
  const adminEmail = "admin@riff.app";
  if (seedDemoUsers && !(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash("admin12345", 10),
        role: "admin",
        countryCode: "US",
        level: { create: {} },
        streak: { create: {} },
      },
    });
    console.log("Admin user: admin@riff.app / admin12345");
  }

  // ---- Sample coupons ----
  const coupons = [
    { code: "TOP1000", type: "percent", value: 25, description: "Top-1000 leaderboard reward", maxRedemptions: 1000 },
    { code: "LAUNCH50", type: "percent", value: 50, description: "Launch promo", maxRedemptions: 500 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, create: c, update: {} });
  }

  // ---- Sample AI content suggestions (pending admin approval) ----
  if ((await prisma.contentSuggestion.count()) === 0) {
    await prisma.contentSuggestion.createMany({
      data: [
        {
          targetType: "lesson",
          title: "Update 'Content Cadence' with 2026 algorithm guidance",
          rationale: "Short-form platforms now weight watch-through and saves more heavily; lesson should mention retention hooks in the first 2s.",
          suggested: JSON.stringify({ addSection: "Retention hooks: open with motion or a question in the first 2 seconds." }),
          sourceUrls: JSON.stringify(["https://example.com/short-form-trends-2026"]),
        },
        {
          targetType: "trend",
          title: "New: AI cover-art tools worth teaching",
          rationale: "Several AI artwork tools have become artist-standard; consider a lesson on prompt-to-cover workflows.",
          suggested: JSON.stringify({ newLesson: "Designing cover art with AI tools" }),
          sourceUrls: JSON.stringify(["https://example.com/ai-artwork"]),
        },
      ],
    });
  }

  // ---- Community forums ----
  const forums = [
    { slug: "general", title: "General Discussion", description: "Talk shop with other independent artists.", orderIndex: 0 },
    { slug: "feedback", title: "Feedback Exchange", description: "Share your work and get peer feedback.", orderIndex: 1 },
    { slug: "showcases", title: "Wins & Showcases", description: "Celebrate milestones and releases.", orderIndex: 2 },
    { slug: "collabs", title: "Collabs & Networking", description: "Find collaborators and build connections.", orderIndex: 3 },
  ];
  for (const f of forums) {
    await prisma.forum.upsert({ where: { slug: f.slug }, create: f, update: {} });
  }

  // ---- Accountability groups ----
  const groups = [
    { name: "30-Day Consistency Crew", genre: null, capacity: 12 },
    { name: "Indie Pop Builders", genre: "pop", capacity: 10 },
    { name: "Release Accountability", genre: null, capacity: 15 },
  ];
  for (const g of groups) {
    const exists = await prisma.accountabilityGroup.findFirst({ where: { name: g.name } });
    if (!exists) await prisma.accountabilityGroup.create({ data: g });
  }

  // ---- Seed a sample community thread ----
  const generalForum = await prisma.forum.findUnique({ where: { slug: "general" } });
  const demo = await prisma.user.findUnique({ where: { email: "demo@riff.app" } });
  if (generalForum && demo && (await prisma.thread.count()) === 0) {
    await prisma.thread.create({
      data: {
        forumId: generalForum.id,
        userId: demo.id,
        title: "What's your biggest marketing struggle right now?",
        kind: "discussion",
        pinned: true,
        posts: { create: { userId: demo.id, body: "For me it's staying consistent with posting. How do you all keep a cadence?" } },
      },
    });
  }

  // ---- Track-completion badges (one per published course) ----
  // Mirrors trackBadgeMeta() in src/lib/gamification.ts. Seeding them up front
  // means they appear (dimmed) on the badge wall before a learner earns them;
  // awardTrackBadge() also upserts lazily, so admin-created courses still work.
  const publishedCourses = await prisma.course.findMany({
    where: { isPublished: true },
    select: { slug: true, title: true },
  });
  for (const c of publishedCourses) {
    await prisma.badge.upsert({
      where: { key: trackBadgeKey(c.slug) },
      create: {
        key: trackBadgeKey(c.slug),
        name: `${c.title} Graduate`,
        description: `Complete every lesson in ${c.title}.`,
        icon: "🎖️",
        tier: "gold",
      },
      update: {},
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
