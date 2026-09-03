// Convert the drafted course JSON into .docx files laid out the way
// src/lib/import/parse-course.ts expects, so they can be uploaded through
// Admin → Import like any other course document.
//
// Run: pnpm exec tsx course-import/make-docx.ts
//
// Conventions the heuristic parser recognises (and the AI parser handles too):
//   Course Title: …        Description: …        Duration: …
//   Module 1: …            Lesson 1: …
//   1. Question text?      A. option   B. option      Correct Answer: B
//   Question: …            Answer: …                  → becomes the assignment
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { ParsedCourse } from "../src/lib/import/types";

const require = createRequire(import.meta.url);
// jszip is present transitively; resolve it without adding a dependency.
const JSZip = require("jszip");

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "docx");
mkdirSync(outDir, { recursive: true });

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Strip the **bold** markers — mammoth extracts raw text, so they'd show literally. */
const plain = (s: string) => s.replace(/\*\*/g, "");

function docLines(course: ParsedCourse): string[] {
  const out: string[] = [];
  out.push(`Course Title: ${course.title}`);
  out.push(`Description: ${course.description}`);
  if (course.durationText) out.push(`Duration: ${course.durationText}`);
  out.push("");

  course.modules.forEach((mod, mi) => {
    out.push(`Module ${mi + 1}: ${mod.title}`);
    out.push("");

    mod.lessons.forEach((lesson, li) => {
      out.push(`Lesson ${li + 1}: ${lesson.title}`);
      out.push("");

      for (const para of plain(lesson.content).split("\n").filter(Boolean)) {
        out.push(para);
        out.push("");
      }

      lesson.questions.forEach((q, qi) => {
        out.push(`${qi + 1}. ${q.prompt}`);
        for (const o of q.options) out.push(`${o.id.toUpperCase()}. ${o.text}`);
        out.push(`Correct Answer: ${q.correct.map((c) => c.toUpperCase()).join(", ")}`);
        if (q.explanation) out.push(`Explanation: ${q.explanation}`);
        out.push("");
      });

      // Action step → the lesson's assignment. The heuristic parser titles every
      // assignment "Short-answer questions", so the real title is carried inline
      // as the first words of the prompt and can be corrected in the preview.
      if (lesson.assignment) {
        out.push(`Question: ${lesson.assignment.title} — ${lesson.assignment.instructions}`);
        out.push(`Answer: Submit your work here for instant AI feedback.`);
        out.push("");
      }
    });
  });

  return out;
}

function buildDocx(lines: string[]): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  const body = lines
    .map((l) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(l)}</w:t></w:r></w:p>`)
    .join("");

  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}</w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function main() {
  const files = readdirSync(here).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const course: ParsedCourse = JSON.parse(readFileSync(join(here, file), "utf8")).course;
    const lines = docLines(course);
    const buf = await buildDocx(lines);
    const name = file.replace(/\.json$/, ".docx");
    writeFileSync(join(outDir, name), buf);
    console.log(`${name.padEnd(30)} ${lines.length} paragraphs · ${(buf.length / 1024).toFixed(1)} KB`);
  }

  console.log(`\n${files.length} .docx files written to course-import/docx/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
