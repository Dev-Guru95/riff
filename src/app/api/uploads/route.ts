import { getSession } from "@/lib/auth";
import { saveUpload, artifactCategory } from "@/lib/upload";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { ok, fail, tooMany, withRoute } from "@/lib/api";

export const runtime = "nodejs";

export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`upload:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected multipart/form-data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file field provided", 422);

  const result = await saveUpload(session.id, file);
  if ("error" in result) return fail(result.error, 422);

  return ok({ url: result.url, category: artifactCategory(result.type), size: result.size }, 201);
});
