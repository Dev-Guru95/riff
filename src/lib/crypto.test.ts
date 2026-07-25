import { describe, it, expect } from "vitest";
import { encrypt, decrypt, encryptNullable, decryptNullable } from "./crypto";

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a value", () => {
    const secret = "ya29.a0AfH6SMB-some-oauth-access-token";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("fails closed on tampered ciphertext", () => {
    const enc = encrypt("secret");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("nullable helpers handle null", () => {
    expect(encryptNullable(null)).toBeNull();
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable(encryptNullable("hi"))).toBe("hi");
  });
});
