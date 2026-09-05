/**
 * Browser-side media probing. Everything here reads the real file:
 * dimensions from the decoder, duration/sample rate from the media element or
 * Web Audio, and frames from a canvas draw. Nothing is simulated.
 */

export interface ImageProbe {
  width: number;
  height: number;
  bytesPerPixel: number;
  previewDataUrl: string;
}

export interface AudioProbe {
  durationSeconds: number;
  sampleRate?: number;
  channels?: number;
  peakDbfs?: number;
  silentRatio?: number;
  clippedRatio?: number;
  decoded: boolean;
}

export interface VideoProbe {
  durationSeconds: number;
  width: number;
  height: number;
  frameDataUrls: string[];
  previewDataUrl: string;
  hasAudioTrackHint: boolean;
}

function objectUrl(file: Blob): string {
  return URL.createObjectURL(file);
}

export async function probeImage(file: Blob): Promise<ImageProbe> {
  const url = objectUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image could not be decoded."));
      el.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      width,
      height,
      bytesPerPixel: file.size / Math.max(width * height, 1),
      previewDataUrl: canvas.toDataURL("image/jpeg", 0.85),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function probeAudio(file: Blob): Promise<AudioProbe> {
  const url = objectUrl(file);
  let duration = 0;
  try {
    duration = await new Promise<number>((resolve, reject) => {
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => resolve(el.duration);
      el.onerror = () => reject(new Error("Audio could not be decoded."));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return { durationSeconds: duration, decoded: false };
    const ctx = new Ctx();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0);
    let peak = 0;
    let silent = 0;
    let clipped = 0;
    const step = Math.max(1, Math.floor(data.length / 200_000));
    let counted = 0;
    for (let i = 0; i < data.length; i += step) {
      const v = Math.abs(data[i]!);
      counted += 1;
      if (v > peak) peak = v;
      if (v < 0.0005) silent += 1;
      if (v > 0.997) clipped += 1;
    }
    await ctx.close();
    return {
      durationSeconds: buffer.duration || duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      peakDbfs: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
      silentRatio: counted ? silent / counted : undefined,
      clippedRatio: counted ? clipped / counted : undefined,
      decoded: true,
    };
  } catch {
    return { durationSeconds: duration, decoded: false };
  }
}

export async function probeVideo(file: Blob, frameCount = 3): Promise<VideoProbe> {
  const url = objectUrl(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Video could not be decoded."));
    });

    const duration = video.duration;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 720 / Math.max(width || 1, height || 1));
    canvas.width = Math.max(1, Math.round((width || 320) * scale));
    canvas.height = Math.max(1, Math.round((height || 240) * scale));
    const ctx = canvas.getContext("2d");

    const frames: string[] = [];
    const targets = Array.from({ length: frameCount }, (_, i) =>
      Math.min(Math.max(duration * ((i + 1) / (frameCount + 1)), 0.05), Math.max(duration - 0.05, 0.05)),
    );

    for (const t of targets) {
      try {
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          const timer = setTimeout(() => reject(new Error("seek timeout")), 4000);
          video.addEventListener("seeked", () => {
            clearTimeout(timer);
            onSeeked();
          });
          video.currentTime = t;
        });
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        /* a frame that will not seek is simply not collected */
      }
    }

    return {
      durationSeconds: duration,
      width,
      height,
      frameDataUrls: frames,
      previewDataUrl: frames[0] ?? "",
      hasAudioTrackHint: (video as unknown as { mozHasAudio?: boolean }).mozHasAudio ?? false,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readHead(file: Blob, bytes = 512 * 1024): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, Math.min(bytes, file.size)).arrayBuffer());
}
