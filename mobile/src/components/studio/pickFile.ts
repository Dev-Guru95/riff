// Pick a brand asset from the photo library or the file system, normalised to
// the LocalFile shape upload() expects. Only the types /api/uploads accepts for
// a brand kit are offered (src/lib/upload.ts ALLOWED: png, jpeg, webp, gif, pdf).

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { LocalFile } from "@/api/client";

const BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};
export const ASSET_TYPES = Object.values(BY_EXT).filter((v, i, a) => a.indexOf(v) === i);

function mimeFor(name: string, given?: string | null) {
  if (given && ASSET_TYPES.includes(given)) return given;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXT[ext] ?? given ?? "application/octet-stream";
}

export async function pickImage(): Promise<LocalFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    // iOS: hand over JPEG instead of HEIC, which the server does not accept.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  const name = a.fileName ?? a.uri.split("/").pop() ?? "image.jpg";
  return { uri: a.uri, name, mimeType: mimeFor(name, a.mimeType) };
}

export async function pickDocument(): Promise<LocalFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ASSET_TYPES, copyToCacheDirectory: true, multiple: false });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  return { uri: a.uri, name: a.name, mimeType: mimeFor(a.name, a.mimeType) };
}
