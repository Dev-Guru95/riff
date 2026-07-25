// Server-only: pull raw text out of an uploaded .docx or .pdf file.
// .docx → mammoth (raw text). .pdf → pdf-parse (imported from its lib entry to
// avoid the package's debug-mode index.js, which tries to read a bundled test PDF).
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/** Error whose message is safe to show the admin (vs. an unexpected 500). */
export class ImportError extends Error {}

export type ExtractResult = { text: string; format: "docx" | "pdf" };

export async function extractText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return { text: value, format: "docx" };
  }
  if (name.endsWith(".pdf")) {
    const data = await pdfParse(buf);
    return { text: data.text, format: "pdf" };
  }
  if (name.endsWith(".doc")) {
    throw new ImportError("Legacy .doc files aren't supported. Open it in Word and 'Save As' .docx, then re-upload.");
  }
  throw new ImportError("Unsupported file type. Upload a .docx or .pdf file.");
}
