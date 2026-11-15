import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/password-reset";
import { isMailConfigured, sendMail, passwordResetEmail } from "@/lib/mailer";
import { APP_URL } from "@/lib/stripe";
import { parseBody, ok, fail, tooMany, withRoute } from "@/lib/api";
import { rateLimit, clientIp, LIMITS } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().email() });

export const POST = withRoute(async (req: Request) => {
  // Two limits: per IP stops someone walking a list of addresses, and the
  // per-email limit below stops one address being mail-bombed from many IPs.
  const rl = rateLimit(`forgot:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const email = data.email.toLowerCase().trim();

  if (!isMailConfigured()) {
    console.warn("auth/forgot: SMTP is not configured — set SMTP_HOST / SMTP_USER / SMTP_PASSWORD.");
    return fail("Password reset isn't available yet. Contact support.", 503);
  }

  const perEmail = rateLimit(`forgot:email:${email}`, 3, 15 * 60_000);
  if (!perEmail.ok) return tooMany(perEmail.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });

  // Always answer the same way. Telling the caller whether an address exists
  // turns this endpoint into a way to enumerate every account on Riff.
  if (user && user.status === "active") {
    const { token } = await issueResetToken(user.id);
    const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = passwordResetEmail(resetUrl, RESET_TOKEN_TTL_MINUTES);
    const sent = await sendMail(email, subject, text, html);
    if (!sent.ok) {
      // Logged, not surfaced: the reason can name our mail host.
      console.error(`auth/forgot: could not send reset mail (${sent.reason})`);
    }
  }

  return ok({ sent: true });
});
