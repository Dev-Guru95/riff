import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { parseBody, ok, fail } from "@/lib/api";

const schema = z.object({
  code: z.string().min(3).regex(/^[A-Z0-9_-]+$/, "uppercase letters, numbers, - and _ only"),
  type: z.enum(["percent", "fixed", "reward"]).default("percent"),
  value: z.number().min(0),
  description: z.string().default(""),
  maxRedemptions: z.number().int().min(0).default(0),
});

export async function POST(req: Request) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const existing = await prisma.coupon.findUnique({ where: { code: body.data.code } });
  if (existing) return fail("A coupon with that code already exists", 409);

  const coupon = await prisma.coupon.create({ data: body.data });
  await writeAudit(session.id, "coupon.create", "coupon", coupon.id, { code: coupon.code });
  return ok(coupon, 201);
}
