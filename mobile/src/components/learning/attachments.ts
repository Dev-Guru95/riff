// Picking files for assignment attachments (the web's "📎 Attach file":
// image, audio, video or PDF up to 25 MB). Camera and library go through
// expo-image-picker, everything else through expo-document-picker.
//
// The server (src/lib/upload.ts) checks the multipart part's MIME type against
// an exact allowlist, so platform variants (audio/x-wav, image/jpg, …) are
// normalised here before upload.

import { Alert, Linking, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { LocalFile } from "@/api/client";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/aac": "audio/mp4",
};

const ALLOWED = new Set(Object.values(EXT_MIME));

function extOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1]!.toLowerCase() : "";
}

/** The server-accepted MIME for a file, or null when the type isn't allowed. */
export function normalizeMime(name: string, mime?: string | null): string | null {
  const m = mime ? (MIME_ALIASES[mime.toLowerCase()] ?? mime.toLowerCase()) : null;
  if (m && ALLOWED.has(m)) return m;
  return EXT_MIME[extOf(name)] ?? null;
}

/** Category the server would assign (artifactCategory), guessed from a URL. */
export function categoryForUrl(url: string): "image" | "audio" | "video" | "pdf" | null {
  const mime = EXT_MIME[extOf(url.split("?")[0] ?? "")];
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "pdf";
}

function prepare(uri: string, name: string, mime: string | null | undefined, size: number | null | undefined): LocalFile | null {
  const type = normalizeMime(name, mime);
  if (!type) {
    Alert.alert("Unsupported file", "Attach an image (PNG, JPG, WEBP, GIF), audio (MP3, WAV, M4A), video (MP4, MOV) or a PDF.");
    return null;
  }
  if (size && size > MAX_UPLOAD_BYTES) {
    Alert.alert("File too large", "Files can be up to 25 MB.");
    return null;
  }
  // Make sure the name carries an extension matching the type.
  const fixedName = extOf(name) ? name : `${name}.${Object.entries(EXT_MIME).find(([, v]) => v === type)?.[0] ?? "bin"}`;
  return { uri, name: fixedName, mimeType: type };
}

function settingsAlert(what: string) {
  Alert.alert(`${what} access is off`, `Allow Riff to use your ${what.toLowerCase()} in Settings to attach files.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

/** Take a photo with the camera (images only: the app doesn't request the microphone). */
export async function pickFromCamera(): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain) settingsAlert("Camera");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return prepare(a.uri, a.fileName ?? `photo-${Date.now()}.jpg`, a.mimeType ?? "image/jpeg", a.fileSize);
}

/** Pick a photo or video from the library. */
export async function pickFromLibrary(): Promise<LocalFile | null> {
  if (Platform.OS === "ios") {
    // Expo docs: request library access first so iOS doesn't prompt after a video is chosen.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && !perm.canAskAgain) {
      settingsAlert("Photos");
      return null;
    }
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.8,
    // iOS: hand back JPEG/MP4 instead of HEIC/HEVC, which the server rejects.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const fallbackName = a.type === "video" ? `video-${Date.now()}.mp4` : `image-${Date.now()}.jpg`;
  return prepare(a.uri, a.fileName ?? fallbackName, a.mimeType, a.fileSize);
}

/** Pick an audio file, video, image or PDF from Files / Drive. */
export async function pickDocument(): Promise<LocalFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "audio/*", "video/mp4", "video/quicktime", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return prepare(a.uri, a.name, a.mimeType, a.size);
}
