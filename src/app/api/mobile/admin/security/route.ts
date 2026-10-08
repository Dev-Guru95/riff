import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import type { AdminSecurityResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/security — src/app/(admin)/admin/security/page.tsx.
// Staff only. Manage MFA with POST /api/auth/mfa/{setup,enable,disable}.
export const GET = withRoute(async () => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const user = await prisma.user.findUnique({
    where: { id: gate.session.id },
    select: { mfaEnabled: true, email: true },
  });
  if (!user) return fail("Not authenticated", 401);

  const body: AdminSecurityResponse = { email: user.email, mfaEnabled: user.mfaEnabled };
  return ok(body);
});
