import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { mimeForUpload, resolveUploadPath, saveUpload } from "./upload";
import { GET } from "@/app/uploads/[userId]/[name]/route";

const NAME = "0123456789abcdef01234567.png";

describe("resolveUploadPath", () => {
  it("accepts exactly the shape saveUpload produces", () => {
    expect(resolveUploadPath("cuser123", NAME, "/data")).toBe(join("/data", "cuser123", NAME));
  });

  it("rejects traversal and anything that isn't a stored upload name", () => {
    for (const [u, n] of [
      ["..", NAME],
      ["cuser123", "../../etc/passwd"],
      ["cuser123", "..%2f.env"],
      ["cuser/x", NAME],
      ["cuser123", "0123456789abcdef01234567.exe"],
      ["cuser123", "short.png"],
      ["", NAME],
    ]) {
      expect(resolveUploadPath(u, n, "/data")).toBeNull();
    }
  });

  it("maps extensions to content types", () => {
    expect(mimeForUpload(NAME)).toBe("image/png");
    expect(mimeForUpload("x.pdf")).toBe("application/pdf");
    expect(mimeForUpload("x.bin")).toBe("application/octet-stream");
  });
});

describe("upload storage + /uploads route", () => {
  let dir: string;
  const prev = process.env.UPLOAD_DIR;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "riff-uploads-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterAll(async () => {
    if (prev === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prev;
    await rm(dir, { recursive: true, force: true });
  });

  const params = (url: string) => {
    const [, , userId, name] = url.split("/");
    return { params: Promise.resolve({ userId, name }) };
  };

  it("saves into UPLOAD_DIR and serves the file back at the returned URL", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6]);
    const saved = await saveUpload("cuser123", new File([bytes], "a.png", { type: "image/png" }));
    if ("error" in saved) throw new Error(saved.error);
    expect(saved.url).toMatch(/^\/uploads\/cuser123\/[a-f0-9]{24}\.png$/);

    const res = await GET(new Request(`http://x${saved.url}`), params(saved.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe("10");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);

    const part = await GET(new Request(`http://x${saved.url}`, { headers: { range: "bytes=2-4" } }), params(saved.url));
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([0x4e, 0x47, 1]);

    const bad = await GET(new Request(`http://x${saved.url}`, { headers: { range: "bytes=50-" } }), params(saved.url));
    expect(bad.status).toBe(416);
  });

  it("404s for unknown files and malformed names", async () => {
    expect((await GET(new Request("http://x"), params(`/uploads/cuser123/${NAME}`))).status).toBe(404);
    expect((await GET(new Request("http://x"), params("/uploads/cuser123/..%2f.env"))).status).toBe(404);
  });
});
