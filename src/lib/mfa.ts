import { generateSecret, generateURI, verifySync } from "otplib";

// TOTP MFA helpers (otplib v13 functional API). Standard 6-digit / 30s TOTP,
// compatible with Google Authenticator / Authy / 1Password.

export function generateMfaSecret(): string {
  return generateSecret();
}

export function mfaKeyUri(email: string, secret: string): string {
  return generateURI({ strategy: "totp", secret, label: email, issuer: "Riff" });
}

export function verifyMfaCode(code: string, secret: string): boolean {
  try {
    // epochTolerance 30s ≈ ±1 time-step for clock skew.
    const result = verifySync({ token: code.replace(/\s/g, ""), secret, epochTolerance: 30 });
    return !!result.valid;
  } catch {
    return false;
  }
}
