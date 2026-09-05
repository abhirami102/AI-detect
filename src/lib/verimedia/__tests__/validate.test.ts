import { describe, expect, it } from "vitest";
import { detectType } from "../signatures";
import {
  extensionOf,
  sanitizeFilename,
  secureStorageName,
  validateDimensions,
  validateDuration,
  validateHeader,
} from "../validate";
import { MAX_FILE_BYTES, MAX_VIDEO_SECONDS } from "../constants";

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]);
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const wav = () => {
  const b = new Uint8Array(16);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  b.set([0x57, 0x41, 0x56, 0x45], 8);
  return b;
};
const mp4 = () => {
  const b = new Uint8Array(16);
  b.set([0, 0, 0, 0x18], 0);
  b.set([0x66, 0x74, 0x79, 0x70], 4);
  b.set([0x69, 0x73, 0x6f, 0x6d], 8);
  return b;
};

describe("magic-byte detection", () => {
  it("detects real signatures", () => {
    expect(detectType(jpeg())?.mime).toBe("image/jpeg");
    expect(detectType(png())?.mime).toBe("image/png");
    expect(detectType(wav())?.mime).toBe("audio/wav");
    expect(detectType(mp4())?.mime).toBe("video/mp4");
  });

  it("returns null for unknown bytes", () => {
    expect(detectType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });
});

describe("validateHeader", () => {
  it("accepts a matching jpeg", () => {
    const r = validateHeader({
      head: jpeg(),
      name: "photo.jpg",
      declaredMime: "image/jpeg",
      sizeBytes: 1024,
    });
    expect(r.ok).toBe(true);
    expect(r.detectedMime).toBe("image/jpeg");
  });

  it("does not trust the declared MIME type", () => {
    const r = validateHeader({
      head: png(),
      name: "evil.png",
      declaredMime: "image/jpeg",
      sizeBytes: 1024,
    });
    expect(r.detectedMime).toBe("image/png");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.field === "mime")).toBe(true);
  });

  it("rejects an extension that disagrees with the bytes", () => {
    const r = validateHeader({
      head: png(),
      name: "photo.jpg",
      declaredMime: "image/png",
      sizeBytes: 1024,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects oversize files", () => {
    const r = validateHeader({
      head: jpeg(),
      name: "p.jpg",
      declaredMime: "image/jpeg",
      sizeBytes: MAX_FILE_BYTES + 1,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /50/.test(i.message))).toBe(true);
  });

  it("rejects empty files", () => {
    const r = validateHeader({
      head: jpeg(),
      name: "p.jpg",
      declaredMime: "image/jpeg",
      sizeBytes: 0,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unrecognised signatures", () => {
    const r = validateHeader({
      head: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      name: "x.jpg",
      declaredMime: "image/jpeg",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
  });
});

describe("filename handling", () => {
  it("strips traversal and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFilename("a/b\\c.jpg")).not.toMatch(/[/\\]/);
  });
  it("reads extensions in lower case", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf("noext")).toBe("");
  });
  it("never reuses the user's name for storage", () => {
    expect(secureStorageName("abc123", "jpg")).toBe("vm_abc123.jpg");
    expect(secureStorageName("abc123", "jpg")).not.toContain("photo");
  });
});

describe("dimension and duration limits", () => {
  it("rejects decompression bombs", () => {
    expect(validateDimensions(60000, 60000).length).toBeGreaterThan(0);
  });
  it("rejects tiny images", () => {
    expect(validateDimensions(4, 4).length).toBeGreaterThan(0);
  });
  it("accepts normal images", () => {
    expect(validateDimensions(1920, 1080)).toHaveLength(0);
  });
  it("caps video duration", () => {
    expect(validateDuration("video", MAX_VIDEO_SECONDS + 1).length).toBeGreaterThan(0);
    expect(validateDuration("video", 10)).toHaveLength(0);
  });
});
