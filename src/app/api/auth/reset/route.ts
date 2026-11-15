import { z } from "zod";
import { resetPasswordWithToken, PASSWORD_MIN, PASSWORD_MAX } from "@/lib/password-reset";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

export const POST = withRoute(async (req: Request) => {
  // Tokens are 32 random bytes, so guessing is hopeless — but rate limiting
  // keeps a flood of attempts from costing us bcrypt work.
  const rl = rateLimit(`reset:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const result = await resetPasswordWithToken(data.token, data.password);
  if (result.ok) return ok({ reset: true });

  if (result.reason === "weak") {
    return fail(`Choose a password between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`, 422);
  }
  // invalid / expired / used are deliberately one message: distinguishing them
  // would confirm that a token once existed.
  return fail("This reset link is no longer valid. Request a new one.", 400, { reason: "invalid_token" });
});
