// Feed the generated .docx files back through RIFF's own extractor + heuristic
// parser and report what the admin would actually see in the import preview.
// Run: pnpm exec tsx course-import/roundtrip.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractText } from "../src/lib/import/extract-text";
import { parseCourse } from "../src/lib/import/parse-course";
import { validateCourse, countEntities } from "../src/lib/import/types";

const here = dirname(fileURLToPath(import.meta.url));
const docxDir = join(here, "docx");

async function main() {
  const files = readdirSync(docxDir).filter((f) => f.endsWith(".docx")).sort();
  let bad = 0;

  for (const file of files) {
    const buf = readFileSync(join(docxDir, file));
    const f = new File([new Uint8Array(buf)], file);

    const { text } = await extractText(f);
    const { course, method } = await parseCourse(text, file);
    const { errors, warnings } = validateCourse(course);
    const c = countEntities(course);

    // Compare against the JSON this docx was generated from.
    const src = JSON.parse(readFileSync(join(here, file.replace(/\.docx$/, ".json")), "utf8")).course;
    const want = countEntities(src);

    const drift: string[] = [];
    if (course.title !== src.title) drift.push(`title "${course.title}" != "${src.title}"`);
    if (c.lessons !== want.lessons) drift.push(`lessons ${c.lessons} != ${want.lessons}`);
    if (c.questions !== want.questions) drift.push(`questions ${c.questions} != ${want.questions}`);
    if (c.assignments !== want.assignments) drift.push(`assignments ${c.assignments} != ${want.assignments}`);

    const ok = !errors.length && !drift.length;
    if (!ok) bad++;
    console.log(
      `${ok ? "✅" : "❌"} ${file.padEnd(30)} [${method}] ` +
        `${c.lessons} lessons · ${c.questions} questions · ${c.assignments} assignments`,
    );
    drift.forEach((d) => console.log(`     DRIFT: ${d}`));
    errors.forEach((e) => console.log(`     ERROR: ${e}`));
    warnings.slice(0, 3).forEach((w) => console.log(`     warn:  ${w}`));

    // Spot-check the first quiz question that came back.
    const q = course.modules.flatMap((m) => m.lessons).flatMap((l) => l.questions)[0];
    if (q && file.startsWith("01")) {
      console.log(`     sample Q: "${q.prompt.slice(0, 60)}…" opts=${q.options.length} correct=${JSON.stringify(q.correct)}`);
    }
  }

  console.log(bad ? `\n${bad} file(s) drifted or failed.` : `\nAll ${files.length} files round-trip clean.`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
