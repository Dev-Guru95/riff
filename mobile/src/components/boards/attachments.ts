// Picking and uploading a card attachment. Two steps, exactly like the web's
// CardModal: POST /api/uploads (multipart, field `file`) → { url, size }, then
// POST /api/cards/[id]/attachments { url, name, mime, size }.

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { api, upload, type LocalFile } from "@/api/client";
import type { UploadResponse } from "@/types/boards";

/** The server's MIME allowlist (src/lib/upload.ts). Max 25 MB. */
export const UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type PickedFile = LocalFile & { size?: number };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "video/quicktime": "mov" };

export async function pickFromLibrary(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.85 });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const mimeType = a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg");
  return { uri: a.uri, name: a.fileName ?? `upload-${Date.now()}.${EXT[mimeType] ?? "jpg"}`, mimeType, size: a.fileSize };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: UPLOAD_TYPES, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream", size: a.size };
}

/** Throws ApiError on failure (validation message from the server). */
export async function attachToCard(cardId: string, file: PickedFile) {
  const up = await upload<UploadResponse>("/api/uploads", file);
  return api<{ id: string }>(`/api/cards/${cardId}/attachments`, {
    method: "POST",
    body: { url: up.url, name: file.name, mime: file.mimeType, size: up.size ?? file.size ?? 0 },
  });
}
