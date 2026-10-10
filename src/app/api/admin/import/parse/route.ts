// POST a .docx/.pdf file → extract text → parse into a ParsedCourse for preview.
// Does NOT write to the database; the admin reviews/edits the result, then commits
// via POST /api/admin/import.
import { requireAdmin } from "@/lib/admin";
import { ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { extractText, ImportError } from "@/lib/import/extract-text";
import { parseCourse } from "@/lib/import/parse-course";
import { validateCourse } from "@/lib/import/types";

export const runtime = "nodejs"; // pdf-parse / mammoth need the Node runtime

const MAX_BYTES = 15 * 1024 * 1024;

export const POST = withRoute(async (req: Request) => {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;

  // Parsing calls the AI provider — gate it on the AI rate-limit bucket.
  const rl = rateLimit(`import:${session.id}`, LIMITS.ai.limit, LIMITS.ai.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected multipart/form-data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file provided.", 422);
  if (file.size > MAX_BYTES) return fail("File too large (max 15 MB).", 422);

  try {
    const { text, format } = await extractText(file);
    if (text.trim().length < 20) {
      return fail("No readable text found. If this is a scanned PDF, it has no extractable text — use a text-based file.", 422);
    }
    const { course, method, truncated } = await parseCourse(text, file.name);
    const { errors, warnings } = validateCourse(course);
    return ok({ course, method, format, truncated, sourceFile: file.name, errors, warnings });
  } catch (err) {
    if (err instanceof ImportError) return fail(err.message, 422);
    console.error("[import/parse] failed:", err);
    return fail("Couldn't parse this document. Try a cleaner file, or create the course manually.", 500);
  }
});
