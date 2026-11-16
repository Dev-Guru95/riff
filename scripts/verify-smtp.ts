/**
 * Check SMTP credentials without guessing.
 *
 *   npx tsx --env-file=.env scripts/verify-smtp.ts
 *   npx tsx --env-file=.env scripts/verify-smtp.ts you@example.com   # also sends a test
 *
 * On the server, run it from the app directory so it picks up that .env:
 *   ssh riff-prod 'cd ~/apps/riff && npx tsx --env-file=.env scripts/verify-smtp.ts'
 *
 * Verifying never sends anything — it opens the connection and authenticates,
 * which is enough to tell a wrong password from a wrong port.
 */
import { isMailConfigured, verifyMailConnection, sendMail, passwordResetEmail } from "../src/lib/mailer";

function mask(v: string | undefined): string {
  if (!v) return "(unset)";
  return v.length <= 4 ? "****" : `${v.slice(0, 2)}…${v.slice(-2)} (${v.length} chars)`;
}

async function main() {
  console.log("SMTP settings");
  console.log("  SMTP_HOST     :", process.env.SMTP_HOST || "(unset)");
  console.log("  SMTP_PORT     :", process.env.SMTP_PORT || "(unset, defaults to 587)");
  console.log("  SMTP_USER     :", process.env.SMTP_USER || "(unset)");
  console.log("  SMTP_PASSWORD :", mask(process.env.SMTP_PASSWORD));
  console.log("  SMTP_FROM     :", process.env.SMTP_FROM || "(unset, falls back to SMTP_USER)");
  console.log("");

  if (!isMailConfigured()) {
    console.error("Not configured: SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set.");
    process.exitCode = 1;
    return;
  }

  const verified = await verifyMailConnection();
  if (!verified.ok) {
    console.error("Connection FAILED:", verified.reason);
    console.error("");
    console.error("Common causes:");
    console.error("  - Using the account password instead of a 16-character app password");
    console.error("  - Port 465 needs implicit TLS; 587 needs STARTTLS. Try the other one.");
    console.error("  - 2-Step Verification not enabled, so no app password exists");
    console.error("  - A Workspace admin has blocked app passwords for this account");
    process.exitCode = 1;
    return;
  }
  console.log("Connection OK — host reachable and credentials accepted.");

  const to = process.argv[2];
  if (!to) {
    console.log("");
    console.log("Pass an address to send a real test message:");
    console.log("  npx tsx --env-file=.env scripts/verify-smtp.ts you@example.com");
    return;
  }

  // Send the actual reset email so the formatting, sender name and spam
  // placement can be checked — the link is deliberately a dead example.
  const { subject, text, html } = passwordResetEmail("https://riffartists.com/reset-password?token=EXAMPLE", 60);
  const sent = await sendMail(to, `[test] ${subject}`, text, html);
  if (sent.ok) {
    console.log(`Test message sent to ${to}. Check inbox and spam.`);
  } else {
    console.error("Send FAILED:", sent.reason);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
