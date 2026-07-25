import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseBody, ok, fail, withRoute } from "@/lib/api";

const schema = z.object({ code: z.string().min(1).transform((s) => s.toUpperCase()) });

// Redeem a coupon. Records the redemption and enforces limits. (Billing
// integration applies the discount at checkout — see Wave 3 / Stripe.)
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const coupon = await prisma.coupon.findUnique({ where: { code: body.data.code } });
  if (!coupon || !coupon.active) return fail("Invalid or inactive coupon", 404);
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return fail("This coupon has expired", 410);
  if (coupon.maxRedemptions > 0 && coupon.redeemed >= coupon.maxRedemptions) return fail("This coupon is fully redeemed", 409);

  const already = await prisma.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId: session.id } },
  });
  if (already) return fail("You've already redeemed this coupon", 409);

  // Atomic: record redemption + bump counter.
  await prisma.$transaction([
    prisma.couponRedemption.create({ data: { couponId: coupon.id, userId: session.id } }),
    prisma.coupon.update({ where: { id: coupon.id }, data: { redeemed: { increment: 1 } } }),
  ]);

  return ok({ code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description });
});
