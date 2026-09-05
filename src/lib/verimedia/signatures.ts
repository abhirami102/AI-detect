/**
 * Magic-byte / container signature detection.
 * Client-declared MIME types are never trusted; this is the source of truth.
 */

export type DetectedType = { mime: string; container: string } | null;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** Reads an ISO-BMFF (MP4/M4A) major brand from the `ftyp` box. */
function isoBrand(bytes: Uint8Array): string | null {
  if (ascii(bytes, 4, 4) !== "ftyp") return null;
  return ascii(bytes, 8, 4).trim();
}

const AUDIO_BRANDS = new Set(["M4A", "M4B", "M4P", "mp42a"]);

export function detectType(bytes: Uint8Array): DetectedType {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", container: "JFIF/EXIF JPEG" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", container: "PNG" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mime: "image/webp", container: "RIFF/WebP" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return { mime: "audio/wav", container: "RIFF/WAVE" };
  }
  if (
    ascii(bytes, 0, 3) === "ID3" ||
    startsWith(bytes, [0xff, 0xfb]) ||
    startsWith(bytes, [0xff, 0xf3]) ||
    startsWith(bytes, [0xff, 0xf2])
  ) {
    return { mime: "audio/mpeg", container: "MPEG audio" };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mime: "video/webm", container: "Matroska/WebM" };
  }
  const brand = isoBrand(bytes);
  if (brand) {
    if (AUDIO_BRANDS.has(brand)) {
      return { mime: "audio/mp4", container: `ISO-BMFF (${brand})` };
    }
    return { mime: "video/mp4", container: `ISO-BMFF (${brand})` };
  }
  return null;
}

/** Bytes required to make a confident decision. */
export const SIGNATURE_PROBE_BYTES = 32;
