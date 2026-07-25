import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// AES-256-GCM encryption for secrets at rest (OAuth tokens). The key is derived
// from APP_ENCRYPTION_KEY (preferred) or JWT_SECRET as a dev fallback. In
// production set a dedicated 32-byte APP_ENCRYPTION_KEY.
function key(): Buffer {
  const material = process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || "dev-insecure-key";
  return createHash("sha256").update(material).digest(); // 32 bytes
}

/** Returns base64 of iv|tag|ciphertext. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// Helpers that tolerate null (unconnected accounts).
export function encryptNullable(s: string | null | undefined): string | null {
  return s ? encrypt(s) : null;
}
export function decryptNullable(s: string | null | undefined): string | null {
  try {
    return s ? decrypt(s) : null;
  } catch {
    return null;
  }
}
