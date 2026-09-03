// Validate the drafted course JSON against the real import contract.
// Run: pnpm exec tsx course-import/validate.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsedCourseSchema, validateCourse, countEntities } from "../src/lib/import/types";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".json")).sort();

let failed = 0;
const totals = { modules: 0, lessons: 0, questions: 0, assignments: 0 };

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(here, file), "utf8"));
  const parsed = parsedCourseSchema.safeParse(raw.course);

  if (!parsed.success) {
    failed++;
    console.log(`\n❌ ${file} — schema rejected`);
    console.log(JSON.stringify(parsed.error.flatten(), null, 2));
    continue;
  }

  const { errors, warnings } = validateCourse(parsed.data);
  const counts = countEntities(parsed.data);
  totals.modules += counts.modules;
  totals.lessons += counts.lessons;
  totals.questions += counts.questions;
  totals.assignments += counts.assignments;

  const mark = errors.length ? "❌" : warnings.length ? "⚠️ " : "✅";
  if (errors.length) failed++;
  console.log(
    `${mark} ${file.padEnd(30)} ${counts.lessons} lessons · ${counts.questions} questions · ${counts.assignments} assignments`,
  );
  errors.forEach((e) => console.log(`     ERROR: ${e}`));
  warnings.forEach((w) => console.log(`     warn:  ${w}`));
}

console.log(
  `\n${files.length} files · ${totals.modules} modules · ${totals.lessons} lessons · ` +
    `${totals.questions} questions · ${totals.assignments} assignments`,
);
console.log(failed ? `\n${failed} file(s) would be REJECTED by the import route.` : "\nAll files import-ready.");
process.exit(failed ? 1 : 0);
