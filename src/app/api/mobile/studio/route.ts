import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";
import { BUILDERS } from "@/lib/studio";
import type { StudioHubResponse } from "@/lib/mobile/types";

// GET /api/mobile/studio — the AI builders listed on the Studio hub
// (src/app/(app)/studio/page.tsx), from src/lib/studio BUILDERS.
// The hub's other tiles (AI_TOOLS, MANAGERS) are declared inside the page file
// and are intentionally not re-declared here — see docs/MOBILE_API.md.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body: StudioHubResponse = { builders: BUILDERS };
  return ok(body);
});
