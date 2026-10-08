import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSession, isNativeClient } from "@/lib/auth";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";
import { normalizeReferral } from "@/lib/referral";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  stageName: z.string().min(1).optional(),
  genres: z.array(z.string()).optional(),
  countryCode: z.string().length(2).optional(),
  // Attribution tag from the link that brought this artist in. Validated
  // again here rather than trusted from the client: it is user-supplied and
  // ends up rendered in admin screens.
  ref: z.string().max(64).optional(),
});

export const POST = withRoute(async (req: Request) => {
  const rl = rateLimit(`signup:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return fail("An account with that email already exists", 409);

  const referralSource = normalizeReferral(data.ref);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      countryCode: data.countryCode,
      referralSource,
      profile: {
        create: {
          stageName: data.stageName,
          genres: JSON.stringify(data.genres ?? []),
        },
      },
      level: { create: {} },
      streak: { create: {} },
    },
  });

  // Auto-enroll in the first published course.
  const course = await prisma.course.findFirst({ where: { isPublished: true }, orderBy: { orderIndex: "asc" } });
  if (course) {
    await prisma.enrollment.create({ data: { userId: user.id, courseId: course.id } });
  }

  await track("signup", user.id, referralSource ? { ref: referralSource } : {});
  const token = await setSession({ id: user.id, email: user.email, role: user.role });
  return ok({ id: user.id, email: user.email, ...(isNativeClient(req) ? { role: user.role, token } : {}) }, 201);
});
