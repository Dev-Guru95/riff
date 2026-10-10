import { clearSession } from "@/lib/auth";
import { ok, withRoute } from "@/lib/api";

export const POST = withRoute(async () => {
  await clearSession();
  return ok({ success: true });
});
