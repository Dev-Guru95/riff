import { prisma } from "@/lib/prisma";
import { ok, withRoute } from "@/lib/api";
import { requireStaff } from "@/lib/mobile/staff";
import type { AdminCouponsResponse } from "@/lib/mobile/types";

// GET /api/mobile/admin/coupons — src/app/(admin)/admin/coupons/page.tsx. Staff only.
// Create with POST /api/admin/coupons; issue rewards with POST /api/admin/rewards/issue.
export const GET = withRoute(async () => {
  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const body: AdminCouponsResponse = {
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      description: c.description,
      maxRedemptions: c.maxRedemptions,
      redeemed: c.redeemed,
      active: c.active,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  };
  return ok(body);
});
