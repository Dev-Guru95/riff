import { getSession } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { ok, fail, withRoute } from "@/lib/api";

export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const ent = await getEntitlements(session.id);
  return ok({ ...ent, billingConfigured: isStripeConfigured() });
});
