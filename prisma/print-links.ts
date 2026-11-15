// Prints every publishable Riff link, ready to paste into Skool.
//
//   pnpm exec tsx prisma/print-links.ts
//   pnpm exec tsx prisma/print-links.ts --md          # markdown table
//   APP_URL=https://riff.soundrig.io pnpm exec tsx prisma/print-links.ts
//
// Reads the course files rather than the database, so it works from a developer
// machine that cannot reach production, and so the output is the same wherever
// it runs — these addresses are built from slugs and ordinals precisely so they
// do not depend on database ids.

import fs from "node:fs";
import path from "node:path";
import { slugify } from "../src/lib/import/create-course";
import { parsedCourseSchema } from "../src/lib/import/types";
import { quizPath, stepPath, absoluteUrl } from "../src/lib/trackLinks";

// riff.soundrig.io is the live site. The old default (riff-app.onrender.com)
// is suspended, so links generated with it dead-end in the Skool classroom.
// An empty APP_URL counts as unset, not as an empty origin.
const LIVE_ORIGIN = "https://riff.soundrig.io";
const ORIGIN = process.env.APP_URL?.trim() || LIVE_ORIGIN;

// These links get pasted into Skool, where a localhost address is useless to
// every student. .env sets APP_URL for local development, so without this the
// script quietly emits http://localhost:3000 links.
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(ORIGIN);
const IMPORT_DIR = path.join(process.cwd(), "course-import");
const MARKDOWN = process.argv.includes("--md");

type Row = { track: number; title: string; kind: string; label: string; url: string };

function main() {
  if (IS_LOCAL) {
    console.error("");
    console.error(`  !!  APP_URL is ${ORIGIN} — these are LOCAL links.`);
    console.error("  !!  Do not paste them into Skool. Re-run with the live origin:");
    console.error(`  !!      APP_URL=${LIVE_ORIGIN} pnpm exec tsx prisma/print-links.ts`);
    console.error("");
  }
  const files = fs
    .readdirSync(IMPORT_DIR)
    .filter((f) => /^\d+-.*\.json$/.test(f))
    .sort();

  const rows: Row[] = [];

  files.forEach((file, i) => {
    const raw = JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, file), "utf-8"));
    const course = parsedCourseSchema.parse(raw.course);
    const slug = slugify(course.title);
    const trackNo = i + 1;
    const lessons = course.modules.flatMap((m) => m.lessons);

    rows.push({
      track: trackNo,
      title: course.title,
      kind: "track",
      label: "Track page",
      url: absoluteUrl(ORIGIN, `/courses/${slug}`),
    });

    // Step numbers count only the lessons that carry an action step, in track
    // order — the same rule the /step/<n> route applies, so the printed link and
    // the route can never disagree about which step is which.
    lessons
      .filter((l) => l.assignment)
      .forEach((l, si) => {
        rows.push({
          track: trackNo,
          title: course.title,
          kind: "step",
          label: l.assignment?.title ?? `Action step ${si + 1}`,
          url: absoluteUrl(ORIGIN, stepPath(slug, si + 1)),
        });
      });

    if (lessons.some((l) => l.questions.length > 0)) {
      rows.push({
        track: trackNo,
        title: course.title,
        kind: "quiz",
        label: `Track ${trackNo} quiz`,
        url: absoluteUrl(ORIGIN, quizPath(slug)),
      });
    }
  });

  if (MARKDOWN) {
    console.log("| Track | What | Link |");
    console.log("| --- | --- | --- |");
    for (const r of rows) console.log(`| ${r.track} | ${r.label} | ${r.url} |`);
  } else {
    let current = 0;
    for (const r of rows) {
      if (r.track !== current) {
        current = r.track;
        console.log(`\n${r.title}`);
        console.log("-".repeat(r.title.length));
      }
      console.log(`  ${r.label.padEnd(38)} ${r.url}`);
    }
  }

  const steps = rows.filter((r) => r.kind === "step").length;
  const quizzes = rows.filter((r) => r.kind === "quiz").length;
  console.log(`\n${rows.length} links: ${files.length} track pages, ${steps} action steps, ${quizzes} quizzes.`);
}

main();
