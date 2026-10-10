import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

// Local-disk upload pipeline. In production this becomes presigned-URL uploads to
// object storage (S3) + an async AV scan; here we validate MIME/size/extension and
// store on local disk so the platform is runnable without cloud infra.
//
// Files live in UPLOAD_DIR, OUTSIDE the app directory, and are served by the
// /uploads/[userId]/[name] route. They used to go in public/uploads, which broke
// twice over: Next only serves public/ files that existed at build time, and the
// self-hosted deploy swaps the whole app directory, discarding everything in it.
// Set UPLOAD_DIR to a persistent path in production (e.g. /home/riff/uploads).
// The default is fine for local dev; on Render's ephemeral disk uploads still
// vanish on redeploy until they move to object storage.

/** Root directory for stored uploads. */
export function uploadRoot(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), "storage", "uploads");
}

const SAFE_USER = /^[a-z0-9]{1,64}$/i;
const SAFE_NAME = /^[a-f0-9]{24}\.(png|jpg|webp|gif|mp3|wav|m4a|mp4|mov|pdf)$/;

/**
 * Absolute path of a stored upload, or null when the segments aren't exactly the
 * shape saveUpload() produces (rules out traversal and arbitrary file reads).
 */
export function resolveUploadPath(userId: string, name: string, root = uploadRoot()): string | null {
  if (!SAFE_USER.test(userId) || !SAFE_NAME.test(name)) return null;
  return join(root, userId, name);
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

export function mimeForUpload(name: string): string {
  return EXT_MIME[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream";
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// MIME -> extension allowlist. Anything else is rejected.
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

export type UploadResult = { url: string; type: string; size: number } | { error: string };

export function artifactCategory(mime: string): "image" | "audio" | "video" | "pdf" | "unknown" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "unknown";
}

export async function saveUpload(userId: string, file: File): Promise<UploadResult> {
  if (!file || typeof file.arrayBuffer !== "function") return { error: "No file provided" };
  if (file.size === 0) return { error: "File is empty" };
  if (file.size > MAX_BYTES) return { error: `File exceeds ${MAX_BYTES / 1024 / 1024}MB limit` };

  const ext = ALLOWED[file.type];
  if (!ext) return { error: `Unsupported file type: ${file.type || "unknown"}` };

  const buf = Buffer.from(await file.arrayBuffer());

  // Lightweight magic-byte sanity check (defense in depth vs. spoofed MIME).
  if (!magicBytesMatch(buf, file.type)) return { error: "File contents do not match its type" };

  const dir = join(uploadRoot(), userId);
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(join(dir, name), buf);

  return { url: `/uploads/${userId}/${name}`, type: file.type, size: file.size };
}

// Minimal signature checks for the riskiest container types.
function magicBytesMatch(buf: Buffer, mime: string): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => buf[i] === b);
  if (mime === "application/pdf") return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (mime === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47]);
  if (mime === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (mime === "image/gif") return startsWith([0x47, 0x49, 0x46]);
  return true; // audio/video/webp: accept (full validation needs a media probe)
}
