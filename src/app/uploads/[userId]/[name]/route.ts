import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { mimeForUpload, resolveUploadPath, uploadRoot } from "@/lib/upload";

// GET /uploads/<userId>/<name> — serves files saved by saveUpload() from
// UPLOAD_DIR (outside the app directory, so they survive deploys). Same URLs the
// app has always handed out, so stored attachment/brand-asset links keep working.
// Access matches the old public/ behaviour: unguessable 96-bit names, no session
// check. Range requests are supported so audio/video can seek and stream.

// Files written before UPLOAD_DIR existed lived in public/uploads.
const LEGACY_ROOT = join(process.cwd(), "public", "uploads");

async function locate(userId: string, name: string) {
  for (const root of [uploadRoot(), LEGACY_ROOT]) {
    const path = resolveUploadPath(userId, name, root);
    if (!path) return null;
    const info = await stat(path).catch(() => null);
    if (info?.isFile()) return { path, size: info.size };
  }
  return null;
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(req: Request, ctx: { params: Promise<{ userId: string; name: string }> }) {
  const { userId, name } = await ctx.params;
  const file = await locate(userId, name);
  if (!file) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": mimeForUpload(name),
    // Names are random and never reused, so the bytes behind a URL never change.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  let start = 0;
  let end = file.size - 1;
  let status = 200;
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    }
    if (m[1] === "") {
      start = Math.max(0, file.size - Number(m[2])); // suffix range: last N bytes
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= file.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);

  // The Node stream closes its file descriptor when it ends or is destroyed
  // (e.g. the client disconnects mid-download).
  const body = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}
