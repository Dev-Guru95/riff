import nodemailer, { type Transporter } from "nodemailer";
import { APP_URL } from "./stripe";

/**
 * Outbound email over SMTP.
 *
 * Optional, like Stripe: with no SMTP_HOST configured nothing is sent and
 * `isMailConfigured()` is false, so features that need mail can degrade to an
 * honest "not available yet" instead of crashing. Riff had no mail provider at
 * all until password reset needed one.
 */
const HOST = () => process.env.SMTP_HOST ?? "";
const PORT = () => Number(process.env.SMTP_PORT ?? 587);
const USER = () => process.env.SMTP_USER ?? "";
const PASS = () => process.env.SMTP_PASSWORD ?? "";
/** Envelope sender. Falls back to the SMTP user, which is right for Gmail/Workspace. */
const FROM = () => process.env.SMTP_FROM || USER();

export function isMailConfigured(): boolean {
  return !!HOST() && !!USER() && !!PASS();
}

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: HOST(),
    port: PORT(),
    // 465 is implicit TLS; 587 upgrades with STARTTLS. Getting this wrong is
    // the usual cause of a silent hang on send.
    secure: PORT() === 465,
    auth: { user: USER(), pass: PASS() },
  });
  return cached;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<SendResult> {
  const t = transporter();
  if (!t) return { ok: false, reason: "SMTP is not configured" };
  try {
    await t.sendMail({ from: FROM(), to, subject, text, html: html ?? undefined });
    return { ok: true };
  } catch (err) {
    // Never surface SMTP errors to the caller's user — they can contain the
    // server's hostname and the account we authenticate as.
    console.error("[mail] send failed:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "send failed" };
  }
}

/** Verify the SMTP credentials without sending anything. */
export async function verifyMailConnection(): Promise<SendResult> {
  const t = transporter();
  if (!t) return { ok: false, reason: "SMTP is not configured" };
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "verify failed" };
  }
}

/** The password-reset email. Plain text first — some clients never render the HTML. */
export function passwordResetEmail(resetUrl: string, expiresMinutes: number) {
  const subject = "Reset your Riff password";
  const text = [
    "Someone asked to reset the password on your Riff account.",
    "",
    `Open this link to choose a new one (it expires in ${expiresMinutes} minutes and works once):`,
    resetUrl,
    "",
    "If this wasn't you, you can ignore this email — your password hasn't changed.",
    "",
    "— Riff",
    APP_URL,
  ].join("\n");

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">Reset your Riff password</h1>
  <p style="margin:0 0 16px;line-height:1.5">Someone asked to reset the password on your Riff account.</p>
  <p style="margin:0 0 24px">
    <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Choose a new password</a>
  </p>
  <p style="margin:0 0 16px;line-height:1.5;color:#555;font-size:14px">
    This link expires in ${expiresMinutes} minutes and can only be used once.
  </p>
  <p style="margin:0 0 16px;line-height:1.5;color:#555;font-size:14px">
    If this wasn't you, ignore this email — your password hasn't changed.
  </p>
  <p style="margin:24px 0 0;color:#888;font-size:12px">${APP_URL}</p>
</div>`.trim();

  return { subject, text, html };
}
