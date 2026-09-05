/**
 * Container metadata extraction that runs on real bytes.
 * Images: JPEG EXIF (TIFF IFD0 / Exif IFD / GPS IFD), PNG text chunks,
 * WebP EXIF/XMP chunk presence. Audio: ID3v2 frames, RIFF INFO, ISO-BMFF udta.
 * No value here is invented — a field is only reported when it is present.
 */

export interface MetadataField {
  key: string;
  value: string;
}

export interface MetadataResult {
  fields: MetadataField[];
  hasExif: boolean;
  hasGps: boolean;
  software?: string | undefined;
  camera?: string | undefined;
  createdAt?: string | undefined;
  notes: string[];
}

const EXIF_TAGS: Record<number, string> = {
  0x010f: "Camera make",
  0x0110: "Camera model",
  0x0131: "Software",
  0x0132: "File modified",
  0x829a: "Exposure time",
  0x829d: "F number",
  0x8827: "ISO",
  0x9003: "Captured (original)",
  0x9004: "Digitised",
  0xa002: "EXIF width",
  0xa003: "EXIF height",
  0xa430: "Owner",
  0xa433: "Lens make",
  0xa434: "Lens model",
};

const GPS_TAGS: Record<number, string> = {
  0x0001: "GPS latitude ref",
  0x0002: "GPS latitude",
  0x0003: "GPS longitude ref",
  0x0004: "GPS longitude",
  0x0006: "GPS altitude",
};

function readString(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

function parseIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean,
  names: Record<number, string>,
  out: MetadataField[],
): { exifIfd?: number; gpsIfd?: number } {
  const pointers: { exifIfd?: number; gpsIfd?: number } = {};
  if (tiffStart + ifdOffset + 2 > view.byteLength) return pointers;
  const count = view.getUint16(tiffStart + ifdOffset, little);
  for (let i = 0; i < count; i += 1) {
    const entry = tiffStart + ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const num = view.getUint32(entry + 4, little);

    if (tag === 0x8769) {
      pointers.exifIfd = view.getUint32(entry + 8, little);
      continue;
    }
    if (tag === 0x8825) {
      pointers.gpsIfd = view.getUint32(entry + 8, little);
      continue;
    }

    const name = names[tag];
    if (!name) continue;

    try {
      if (type === 2) {
        const valueOffset = num > 4 ? tiffStart + view.getUint32(entry + 8, little) : entry + 8;
        const str = readString(view, valueOffset, Math.min(num, 128));
        if (str) out.push({ key: name, value: str });
      } else if (type === 3) {
        out.push({ key: name, value: String(view.getUint16(entry + 8, little)) });
      } else if (type === 4) {
        out.push({ key: name, value: String(view.getUint32(entry + 8, little)) });
      } else if (type === 5 && num >= 1) {
        const off = tiffStart + view.getUint32(entry + 8, little);
        if (off + 8 <= view.byteLength) {
          const n = view.getUint32(off, little);
          const d = view.getUint32(off + 4, little);
          if (d !== 0) out.push({ key: name, value: `${(n / d).toFixed(4)}` });
        }
      }
    } catch {
      /* malformed tag — skip, never guess */
    }
  }
  return pointers;
}

function parseJpeg(bytes: Uint8Array): MetadataResult {
  const fields: MetadataField[] = [];
  const notes: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  let hasExif = false;
  let hasGps = false;
  let markers = 0;
  let progressive = false;
  let quantTables = 0;

  while (offset + 4 < bytes.length) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // start of scan
    const length = view.getUint16(offset + 2, false);
    markers += 1;
    if (marker === 0xc2) progressive = true;
    if (marker === 0xdb) quantTables += 1;

    if (marker === 0xe1 && readString(view, offset + 4, 4) === "Exif") {
      hasExif = true;
      const tiffStart = offset + 10;
      if (tiffStart + 8 <= bytes.length) {
        const little = readString(view, tiffStart, 2) === "II";
        const firstIfd = view.getUint32(tiffStart + 4, little);
        const ptr = parseIfd(view, tiffStart, firstIfd, little, EXIF_TAGS, fields);
        if (ptr.exifIfd) parseIfd(view, tiffStart, ptr.exifIfd, little, EXIF_TAGS, fields);
        if (ptr.gpsIfd) {
          const before = fields.length;
          parseIfd(view, tiffStart, ptr.gpsIfd, little, GPS_TAGS, fields);
          hasGps = fields.length > before;
        }
      }
    }
    if (marker === 0xed) fields.push({ key: "IPTC block", value: "present" });
    if (marker === 0xe1 && readString(view, offset + 4, 4) !== "Exif") {
      fields.push({ key: "XMP block", value: "present" });
    }
    offset += 2 + length;
  }

  fields.push({ key: "JPEG marker segments", value: String(markers) });
  fields.push({ key: "Quantisation tables", value: String(quantTables) });
  fields.push({ key: "Encoding", value: progressive ? "Progressive" : "Baseline" });
  if (!hasExif) notes.push("No EXIF block found.");

  return {
    fields,
    hasExif,
    hasGps,
    software: fields.find((f) => f.key === "Software")?.value,
    camera:
      [
        fields.find((f) => f.key === "Camera make")?.value,
        fields.find((f) => f.key === "Camera model")?.value,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    createdAt: fields.find((f) => f.key === "Captured (original)")?.value,
    notes,
  };
}

function chunksPng(bytes: Uint8Array): MetadataResult {
  const fields: MetadataField[] = [];
  const notes: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let hasExif = false;
  const textKeys: string[] = [];

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = readString(view, offset + 4, 4);
    if (!type) break;
    if (type === "eXIf") hasExif = true;
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const key = readString(view, offset + 8, Math.min(length, 79));
      if (key) textKeys.push(key);
      if (type === "tEXt") {
        const value = readString(
          view,
          offset + 8 + key.length + 1,
          Math.min(length - key.length - 1, 200),
        );
        if (value) fields.push({ key: `PNG:${key}`, value });
      }
    }
    if (type === "IDAT" || type === "IEND") break;
    offset += 12 + length;
    if (length > bytes.length) break;
  }

  if (textKeys.length) fields.push({ key: "PNG text chunks", value: textKeys.join(", ") });
  else notes.push("No PNG text chunks present.");

  const software = fields.find((f) => /software|Software|parameters|prompt/i.test(f.key))?.value;
  return { fields, hasExif, hasGps: false, software, notes };
}

function riffChunks(bytes: Uint8Array): MetadataResult {
  const fields: MetadataField[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  const seen: string[] = [];
  let hasExif = false;
  while (offset + 8 <= bytes.length) {
    const type = readString(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (!type) break;
    seen.push(type);
    if (type === "EXIF") hasExif = true;
    if (type === "fmt ") {
      if (offset + 24 <= bytes.length) {
        fields.push({ key: "Audio format code", value: String(view.getUint16(offset + 8, true)) });
        fields.push({ key: "Channels", value: String(view.getUint16(offset + 10, true)) });
        fields.push({ key: "Sample rate", value: `${view.getUint32(offset + 12, true)} Hz` });
        fields.push({ key: "Bits per sample", value: String(view.getUint16(offset + 22, true)) });
      }
    }
    offset += 8 + size + (size % 2);
    if (size === 0) break;
  }
  fields.push({ key: "RIFF chunks", value: seen.join(", ") || "none" });
  return { fields, hasExif, hasGps: false, notes: [] };
}

function id3Tags(bytes: Uint8Array): MetadataResult {
  const fields: MetadataField[] = [];
  const notes: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readString(view, 0, 3) !== "ID3") {
    notes.push("No ID3 tag present.");
    return { fields, hasExif: false, hasGps: false, notes };
  }
  const size =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);
  fields.push({ key: "ID3 version", value: `2.${view.getUint8(3)}.${view.getUint8(4)}` });
  let offset = 10;
  const end = Math.min(10 + size, bytes.length);
  const names: Record<string, string> = {
    TSSE: "Encoder",
    TENC: "Encoded by",
    TIT2: "Title",
    TDRC: "Recorded",
    TDEN: "Encoding time",
  };
  while (offset + 10 <= end) {
    const id = readString(view, offset, 4);
    const frameSize = view.getUint32(offset + 4, false);
    if (!id || frameSize <= 0) break;
    if (names[id]) {
      fields.push({
        key: names[id]!,
        value: readString(view, offset + 11, Math.min(frameSize - 1, 120)),
      });
    }
    offset += 10 + frameSize;
  }
  return {
    fields,
    hasExif: false,
    hasGps: false,
    software: fields.find((f) => f.key === "Encoder")?.value,
    notes,
  };
}

function isoBoxes(bytes: Uint8Array): MetadataResult {
  const fields: MetadataField[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: string[] = [];
  let offset = 0;
  let brand = "";
  while (offset + 8 <= bytes.length && boxes.length < 24) {
    const size = view.getUint32(offset, false);
    const type = readString(view, offset + 4, 4);
    if (!type) break;
    boxes.push(type);
    if (type === "ftyp") brand = readString(view, offset + 8, 4);
    if (size < 8) break;
    offset += size;
  }
  if (brand) fields.push({ key: "Major brand", value: brand });
  fields.push({ key: "Top-level boxes", value: boxes.join(", ") || "none" });
  const notes: string[] = [];
  if (!boxes.includes("udta") && !boxes.includes("meta")) {
    notes.push("No user-data / metadata box at the top level.");
  }
  return { fields, hasExif: false, hasGps: false, notes };
}

export function extractMetadata(bytes: Uint8Array, detectedMime: string): MetadataResult {
  try {
    switch (detectedMime) {
      case "image/jpeg":
        return parseJpeg(bytes);
      case "image/png":
        return chunksPng(bytes);
      case "image/webp":
      case "audio/wav":
        return riffChunks(bytes);
      case "audio/mpeg":
        return id3Tags(bytes);
      case "audio/mp4":
      case "video/mp4":
        return isoBoxes(bytes);
      case "video/webm":
        return {
          fields: [{ key: "Container", value: "Matroska / WebM (EBML)" }],
          hasExif: false,
          hasGps: false,
          notes: ["WebM tag parsing is limited to container identification in this build."],
        };
      default:
        return { fields: [], hasExif: false, hasGps: false, notes: ["Unsupported container."] };
    }
  } catch {
    return {
      fields: [],
      hasExif: false,
      hasGps: false,
      notes: ["Metadata block could not be parsed."],
    };
  }
}
