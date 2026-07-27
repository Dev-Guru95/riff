import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { searchProjects } from "@/lib/boards";

// GET /api/search?q=... — global project search scoped to the user's boards.
export const GET = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchProjects(session.id, q);
  return ok({ results });
});
