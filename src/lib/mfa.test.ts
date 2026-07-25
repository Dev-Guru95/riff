import { describe, it, expect } from "vitest";
import { generateSync } from "otplib";
import { generateMfaSecret, mfaKeyUri, verifyMfaCode } from "./mfa";

describe("MFA / TOTP", () => {
  it("generates a base32 secret and a valid otpauth URI", () => {
    const secret = generateMfaSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    const uri = mfaKeyUri("artist@riff.app", secret);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("Riff");
  });

  it("accepts the current code and rejects a wrong one", () => {
    const secret = generateMfaSecret();
    const code = generateSync({ secret });
    expect(verifyMfaCode(code, secret)).toBe(true);
    expect(verifyMfaCode("000000", secret)).toBe(false);
  });

  it("tolerates whitespace in the entered code", () => {
    const secret = generateMfaSecret();
    const code = generateSync({ secret });
    expect(verifyMfaCode(`${code.slice(0, 3)} ${code.slice(3)}`, secret)).toBe(true);
  });
});
