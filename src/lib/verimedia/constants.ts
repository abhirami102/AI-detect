import type { MediaKind } from "./types";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_SECONDS = 120;
export const MAX_IMAGE_PIXELS = 100_000_000; // decompression-bomb guard
export const MIN_IMAGE_DIMENSION = 16;

export interface SupportedFormat {
  mime: string;
  kind: MediaKind;
  extensions: string[];
  label: string;
}

export const SUPPORTED_FORMATS: SupportedFormat[] = [
  { mime: "image/jpeg", kind: "image", extensions: ["jpg", "jpeg"], label: "JPEG" },
  { mime: "image/png", kind: "image", extensions: ["png"], label: "PNG" },
  { mime: "image/webp", kind: "image", extensions: ["webp"], label: "WebP" },
  { mime: "audio/wav", kind: "audio", extensions: ["wav"], label: "WAV" },
  { mime: "audio/mpeg", kind: "audio", extensions: ["mp3"], label: "MP3" },
  { mime: "audio/mp4", kind: "audio", extensions: ["m4a"], label: "M4A" },
  { mime: "video/mp4", kind: "video", extensions: ["mp4"], label: "MP4" },
  { mime: "video/webm", kind: "video", extensions: ["webm"], label: "WebM" },
];

export const ACCEPT_ATTRIBUTE = SUPPORTED_FORMATS.flatMap((f) =>
  f.extensions.map((e) => `.${e}`),
).join(",");

export function formatForMime(mime: string): SupportedFormat | undefined {
  return SUPPORTED_FORMATS.find((f) => f.mime === mime);
}
