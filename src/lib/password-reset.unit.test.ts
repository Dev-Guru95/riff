import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PASSWORD_MIN, PASSWORD_MAX, RESET_TOKEN_TTL_MINUTES } from "./password-reset";
import { isMailConfigured, passwordResetEmail } from "./mailer";

describe("password bounds", () => {
  it("requires a real password but stays inside bcrypt's limit", () => {
    expect(PASSWORD_MIN).toBeGreaterThanOrEqual(8);
    // bcrypt silently ignores bytes past 72; accepting more would be a lie.
    expect(PASSWORD_MAX).toBeLessThanOrEqual(72);
    expect(PASSWORD_MAX).toBeGreaterThan(PASSWORD_MIN);
  });

  it("expires links soon enough to matter", () => {
    expect(RESET_TOKEN_TTL_MINUTES).toBeGreaterThan(0);
    expect(RESET_TOKEN_TTL_MINUTES).toBeLessThanOrEqual(24 * 60);
  });
});

describe("isMailConfigured", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is false until host, user and password are all set", () => {
    expect(isMailConfigured()).toBe(false);
    process.env.SMTP_HOST = "smtp.gmail.com";
    expect(isMailConfigured()).toBe(false);
    process.env.SMTP_USER = "team@riffartists.com";
    expect(isMailConfigured()).toBe(false);
    process.env.SMTP_PASSWORD = "app-password";
    expect(isMailConfigured()).toBe(true);
  });
});

describe("passwordResetEmail", () => {
  const url = "https://riff.soundrig.io/reset-password?token=abc123";

  it("puts the link and the expiry in both plain text and HTML", () => {
    const { subject, text, html } = passwordResetEmail(url, 60);
    expect(subject).toMatch(/reset/i);
    expect(text).toContain(url);
    expect(html).toContain(url);
    expect(text).toContain("60 minutes");
    expect(html).toContain("60 minutes");
  });

  it("tells someone who didn't ask for it that nothing has changed", () => {
    // Without this line a reset email reads like a breach notification.
    const { text, html } = passwordResetEmail(url, 60);
    expect(text).toMatch(/wasn't you/i);
    expect(html).toMatch(/wasn't you/i);
  });

  it("says the link is single use", () => {
    const { text, html } = passwordResetEmail(url, 60);
    expect(text).toMatch(/once/i);
    expect(html).toMatch(/once/i);
  });
});
