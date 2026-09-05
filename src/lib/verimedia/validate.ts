import { MAX_FILE_BYTES, MAX_IMAGE_PIXELS, MIN_IMAGE_DIMENSION, MAX_VIDEO_SECONDS, SUPPORTED_FORMATS, formatForMime } from "./constants";
import { detectType } from "./signatures";
import type { MediaKind } from "./types";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface FileValidation {
  ok: boolean;
  issues: ValidationIssue[];
  detectedMime?: string;
  container?: string;
  kind?: MediaKind;
  extension?: string;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .replace(/_{2,}/g, "_");
  const safe = cleaned.length ? cleaned : "file";
  return safe.slice(0, 128);
}

export function extensionOf(name: string): string {
  const clean = sanitizeFilename(name);
  const idx = clean.lastIndexOf(".");
  return idx === -1 ? "" : clean.slice(idx + 1).toLowerCase();
}

/** Deterministic, non-guessable storage name derived from a random id. */
export function secureStorageName(randomId: string, extension: string): string {
  const id = randomId.replace(/[^a-f0-9]/gi, "").slice(0, 32) || "0".repeat(32);
  const ext = extension.replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase();
  return ext ? `vm_${id}.${ext}` : `vm_${id}`;
}

export function validateHeader(input: {
  name: string;
  sizeBytes: number;
  declaredMime: string;
  head: Uint8Array;
}): FileValidation {
  const issues: ValidationIssue[] = [];

  if (input.sizeBytes <= 0) {
    issues.push({ field: "size", message: "File is empty." });
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    issues.push({
      field: "size",
      message: `File is ${(input.sizeBytes / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB.`,
    });
  }

  const detected = detectType(input.head);
  if (!detected) {
    issues.push({
      field: "signature",
      message: "Unrecognised file signature. Supported: JPEG, PNG, WebP, WAV, MP3, M4A, MP4, WebM.",
    });
    return { ok: false, issues };
  }

  const format = formatForMime(detected.mime);
  if (!format) {
    issues.push({ field: "signature", message: `Detected ${detected.mime}, which is not supported.` });
    return { ok: false, issues, detectedMime: detected.mime, container: detected.container };
  }

  const ext = extensionOf(input.name);
  if (ext && !format.extensions.includes(ext)) {
    issues.push({
      field: "extension",
      message: `Extension ".${ext}" does not match the detected format (${format.label}).`,
    });
  }

  if (input.declaredMime && input.declaredMime !== detected.mime) {
    const declaredIsAlias =
      (detected.mime === "audio/mpeg" && input.declaredMime === "audio/mp3") ||
      (detected.mime === "audio/mp4" && ["audio/x-m4a", "audio/m4a"].includes(input.declaredMime)) ||
      (detected.mime === "audio/wav" && ["audio/x-wav", "audio/wave"].includes(input.declaredMime));
    if (!declaredIsAlias) {
      issues.push({
        field: "mime",
        message: `Browser reported "${input.declaredMime}" but the bytes say ${format.label}. The bytes win.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    detectedMime: detected.mime,
    container: detected.container,
    kind: format.kind,
    extension: format.extensions[0],
  };
}

export function validateDimensions(width: number, height: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    issues.push({ field: "dimensions", message: "Image dimensions could not be read." });
    return issues;
  }
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    issues.push({ field: "dimensions", message: `Image is smaller than ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} px.` });
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    issues.push({ field: "dimensions", message: "Image exceeds the 100 megapixel processing limit." });
  }
  return issues;
}

export function validateDuration(kind: MediaKind, seconds: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(seconds) || seconds <= 0) {
    issues.push({ field: "duration", message: "Duration could not be read from the container." });
    return issues;
  }
  if (kind === "video" && seconds > MAX_VIDEO_SECONDS) {
    issues.push({
      field: "duration",
      message: `Video is ${Math.round(seconds)}s. The limit is ${MAX_VIDEO_SECONDS}s.`,
    });
  }
  return issues;
}

export const SUPPORTED_LABELS = SUPPORTED_FORMATS.map((f) => f.label);
