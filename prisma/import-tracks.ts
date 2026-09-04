// Imports The Launchpad's 8 tracks from course-import/*.json.
//
//   pnpm exec tsx prisma/import-tracks.ts            # import anything missing
//   pnpm exec tsx prisma/import-tracks.ts --republish # also re-apply order/publish
//
// Why a script and not just the admin UI: the file order IS the Skool order
// (course-import/README.md, sourced from "SoundRig Skool - Full Course Content"
// v4.0), so importing by filename is what makes Riff's track order match Skool
// by construction rather than by someone remembering to upload in sequence. It
// also means the whole program can be rebuilt after a database reset without 8
// manual uploads — which is exactly the situation that produced an empty
// catalogue and a Welcome Track link pointing at the seeded demo course.
//
// Idempotent. A track already present (matched on slug) is left alone; only its
// orderIndex and published flag are re-applied, and only with --republish. It
// never re-imports, because the import route appends "-2" to a duplicate slug
// and that would break every link already published in Skool.
//
// It also chains the tracks: each finished track is pointed at the NEXT Skool
// track, read from course-import/skool-links.json. The Skool URLs are the one
// thing that cannot be known from this repo, so a human supplies those once; the
// off-by-one (track N sends to track N+1) is computed, not typed. Re-applied on
// every deploy, because these settings are the easiest thing to lose to a
// database rebuild and losing them breaks the loop without breaking anything
// visible. An unfilled entry keeps resolveReturnLink()'s community-root
// fallback, so a half-filled config never produces a dead link.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parsedCourseSchema, validateCourse } from "../src/lib/import/types";
import { createCourseFromParsed, slugify } from "../src/lib/import/create-course";
import { chainTrackReturns } from "../src/lib/returnLink";

const prisma = new PrismaClient();
const IMPORT_DIR = path.join(process.cwd(), "course-import");
const REPUBLISH = process.argv.includes("--republish");
/** The seed's sample course, superseded by the real Launchpad tracks. */
const RETIRED_PLACEHOLDER_SLUG = "marketing-foundations";

async function main() {
  if (!fs.existsSync(IMPORT_DIR)) {
    console.error(`import-tracks: ${IMPORT_DIR} not found.`);
    process.exit(1);
  }

  // Numeric filename prefixes (01…08) ARE the Skool order. Sorting by filename
  // is therefore the single source of truth for orderIndex — there is no second
  // ordering system to keep in step.
  const files = fs
    .readdirSync(IMPORT_DIR)
    .filter((f) => /^\d+-.*\.json$/.test(f))
    .sort();

  if (files.length === 0) {
    console.error("import-tracks: no NN-*.json track files found.");
    process.exit(1);
  }

  console.log(`import-tracks: found ${files.length} track file(s).`);
  let created = 0;
  let skipped = 0;

  for (const [i, file] of files.entries()) {
    const raw = JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, file), "utf-8"));
    const parsed = parsedCourseSchema.safeParse(raw.course);
    if (!parsed.success) {
      console.error(`  ✗ ${file}: does not match parsedCourseSchema.`);
      console.error(parsed.error.issues.map((x) => `      ${x.path.join(".")}: ${x.message}`).join("\n"));
      process.exit(1);
    }

    // Same gate the admin route applies — never import a structurally broken course.
    const { errors } = validateCourse(parsed.data);
    if (errors.length) {
      console.error(`  ✗ ${file}: ${errors.join(" | ")}`);
      process.exit(1);
    }

    const slug = slugify(parsed.data.title);
    const existing = await prisma.course.findUnique({ where: { slug } });

    if (existing) {
      skipped++;
      if (REPUBLISH) {
        await prisma.course.update({
          where: { slug },
          data: { orderIndex: i, isPublished: true },
        });
        console.log(`  = ${slug} (already imported — order ${i}, published)`);
      } else {
        console.log(`  = ${slug} (already imported — skipped)`);
      }
      continue;
    }

    // Published on import: an unpublished track is invisible in the catalogue,
    // and the whole point is that the Skool link has somewhere real to land.
    await createCourseFromParsed(parsed.data, {
      slug,
      orderIndex: i,
      isPublished: true,
      stripLessonContent: true,
    });
    created++;
    console.log(`  + ${slug} (order ${i})`);
  }

  await applyReturnLinks();

  const trackSlugs = new Set(
    files.map((f) => slugify(JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, f), "utf-8")).course.title)),
  );

  const published = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: [{ orderIndex: "asc" }, { slug: "asc" }],
    select: { slug: true, orderIndex: true, title: true },
  });

  console.log(`\nimport-tracks: ${created} created, ${skipped} already present.`);
  console.log("Published track order:");
  for (const c of published) console.log(`  ${c.orderIndex}. ${c.title}  →  /courses/${c.slug}`);

  await stripTeachingText([...trackSlugs]);
  await retirePlaceholderCourse(published.length, trackSlugs.size);

  // Any OTHER non-Launchpad course is reported, never touched: an admin may have
  // published it deliberately, and silently hiding someone's course would be a
  // content decision this script has no business making.
  const strays = published.filter(
    (c) => !trackSlugs.has(c.slug) && c.slug !== RETIRED_PLACEHOLDER_SLUG,
  );
  if (strays.length) {
    console.warn(
      `\n⚠  ${strays.length} published course(s) are not Launchpad tracks and will appear` +
        " alongside them in the catalogue:",
    );
    for (const c of strays) console.warn(`     ${c.title}  (/courses/${c.slug}, order ${c.orderIndex})`);
    console.warn("   Unpublish them in Admin → Courses if they should not be part of the program.");
  }
  console.log(
    "\nTo chain the tracks together, fill in course-import/skool-links.json with each" +
      "\ntrack's Skool URL and redeploy — no admin clicking, and it survives a rebuild.",
  );
}

/**
 * Point each finished track at the NEXT Skool track, from
 * course-import/skool-links.json.
 *
 * Re-applied on every deploy on purpose: these are the settings most easily lost
 * to a database rebuild, and losing them silently breaks the Skool ⇄ Riff loop
 * without breaking anything visible. Doing it here rather than in the admin
 * screens also removes the off-by-one — the file records where each track LIVES,
 * and the chaining works out where each track SENDS.
 */
async function applyReturnLinks(): Promise<void> {
  const file = path.join(IMPORT_DIR, "skool-links.json");
  if (!fs.existsSync(file)) {
    console.log("import-tracks: no skool-links.json — tracks keep the community-root fallback.");
    return;
  }

  const config = JSON.parse(fs.readFileSync(file, "utf-8"));
  // Order comes from the numbered course files, NOT from the database: a track
  // that failed to import must not shift the ones after it, and whichever track
  // is last in the DB must not be mistaken for the graduating one.
  const orderedSlugs = orderedTrackSlugs();

  const chained = chainTrackReturns(orderedSlugs, config.tracks ?? [], config.graduation);
  if (chained.length === 0) {
    console.log(
      "import-tracks: skool-links.json has no usable URLs yet — every track keeps the" +
        " community-root fallback. Fill it in to chain the tracks together.",
    );
    return;
  }

  let wired = 0;
  let absent = 0;
  for (const link of chained) {
    // updateMany, not update: a slug that is not in the database yet must be a
    // no-op, not a crash that fails the whole deploy.
    const res = await prisma.course.updateMany({
      where: { slug: link.slug },
      data: { returnUrl: link.url, returnLabel: link.label },
    });
    if (res.count === 0) {
      absent++;
      console.warn(`  ! ${link.slug} not in the database — skipped`);
      continue;
    }
    wired++;
    console.log(`  → ${link.slug} finishes to: ${link.label}`);
  }

  const unwired = orderedSlugs.length - wired - absent;
  console.log(
    `import-tracks: ${wired} track(s) chained to the next Skool track` +
      (unwired > 0 ? `, ${unwired} still on the community-root fallback.` : "."),
  );
}

/**
 * The program's slugs in track order, straight from the numbered files.
 * Position i is track number i+1 — the mapping the whole chain depends on.
 */
function orderedTrackSlugs(): string[] {
  return fs
    .readdirSync(IMPORT_DIR)
    .filter((f) => /^\d+-.*\.json$/.test(f))
    .sort()
    .map((f) => slugify(JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, f), "utf-8")).course.title));
}

/**
 * Clear the Skool teaching text out of tracks that were imported with it.
 *
 * The first bulk import carried the lesson prose across, making Riff a mirror of
 * Skool — the same paragraphs in two places, to be corrected in two places, and
 * a learner reading the lesson twice. Riff holds the quizzes, the action steps
 * and the points; the teaching stays in Skool.
 *
 * Scoped to Launchpad tracks by slug, so a course an admin uploaded through the
 * import screen keeps its content. Idempotent: only rows that still have text
 * are touched, so a normal deploy is a no-op.
 */
async function stripTeachingText(trackSlugs: string[]): Promise<void> {
  const res = await prisma.lesson.updateMany({
    where: {
      module: { course: { slug: { in: trackSlugs } } },
      NOT: { content: "" },
    },
    data: { content: "" },
  });
  if (res.count > 0) {
    console.log(
      `\n✓ Cleared duplicated Skool teaching text from ${res.count} lesson(s).` +
        "\n  Riff now shows only the quiz and action steps for these tracks.",
    );
  }
}

/**
 * Retire the seeded placeholder course, "Music Marketing Foundations".
 *
 * It existed only while the real tracks had no content, and it is not part of
 * the program. Leaving it published is not merely untidy: the program
 * certificate requires completing EVERY published course, so it silently makes
 * the program nine tracks long and blocks certification for artists who have
 * finished all eight.
 *
 * Unpublished, never deleted — enrolments, progress and XP survive, and an
 * admin can republish it in one click if it is ever wanted again.
 *
 * Guarded on the full program being present so this can never empty the
 * catalogue: if the tracks failed to import, the placeholder stays up as the
 * only thing an artist can see.
 */
async function retirePlaceholderCourse(publishedCount: number, expectedTracks: number): Promise<void> {
  const placeholder = await prisma.course.findUnique({
    where: { slug: RETIRED_PLACEHOLDER_SLUG },
    select: { isPublished: true, title: true },
  });
  if (!placeholder || !placeholder.isPublished) return;

  // publishedCount includes the placeholder itself, hence the +1.
  if (publishedCount < expectedTracks + 1) {
    console.warn(
      `\n⚠  Not retiring "${placeholder.title}": only ${publishedCount - 1} of ${expectedTracks}` +
        " tracks are published, and hiding it now would leave artists with an empty catalogue.",
    );
    return;
  }

  await prisma.course.update({
    where: { slug: RETIRED_PLACEHOLDER_SLUG },
    data: { isPublished: false },
  });
  console.log(
    `\n✓ Retired the placeholder course "${placeholder.title}" (unpublished, not deleted).` +
      "\n  The program is now the 8 Launchpad tracks, which is what the certificate counts.",
  );
}

main()
  .catch((e) => {
    console.error("import-tracks failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
