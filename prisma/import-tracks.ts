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
// Return links are deliberately NOT set here. Each track should hand the learner
// back to the NEXT Skool track, and those URLs live in Skool, not in this repo.
// resolveReturnLink() falls back to the community root so the loop still closes;
// set the per-track URLs in Admin → Courses → "When this track is finished".

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parsedCourseSchema, validateCourse } from "../src/lib/import/types";
import { createCourseFromParsed, slugify } from "../src/lib/import/create-course";

const prisma = new PrismaClient();
const IMPORT_DIR = path.join(process.cwd(), "course-import");
const REPUBLISH = process.argv.includes("--republish");

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
    await createCourseFromParsed(parsed.data, { slug, orderIndex: i, isPublished: true });
    created++;
    console.log(`  + ${slug} (order ${i})`);
  }

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

  // The seed's demo course ("Music Marketing Foundations") also sits at
  // orderIndex 0, so it ties with Track 1 and appears in the catalogue beside
  // the real program. Reported rather than silently unpublished: what learners
  // can see is a content decision, not this script's call to make.
  const strays = published.filter((c) => !trackSlugs.has(c.slug));
  if (strays.length) {
    console.warn(
      `\n⚠  ${strays.length} published course(s) are not Launchpad tracks and will appear` +
        " alongside them in the catalogue:",
    );
    for (const c of strays) console.warn(`     ${c.title}  (/courses/${c.slug}, order ${c.orderIndex})`);
    console.warn("   Unpublish them in Admin → Courses if they should not be part of the program.");
  }
  console.log(
    "\nNext: set each track's return link in Admin → Courses → \"When this track is finished\"" +
      "\nso finishing a track hands the learner to the NEXT Skool track.",
  );
}

main()
  .catch((e) => {
    console.error("import-tracks failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
