import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

// Local-disk upload pipeline. In production this becomes presigned-URL uploads to
// object storage (S3) + an async AV scan; here we validate MIME/size/extension and
// store under /public/uploads so the platform is runnable without cloud infra.

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

  const dir = join(process.cwd(), "public", "uploads", userId);
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
