import type { AudioProbe, ImageProbe, VideoProbe } from "./probe";
import type { Evidence, Severity } from "./types";

let counter = 0;
export function ev(
  source: Evidence["source"],
  category: string,
  observation: string,
  interpretation: string,
  severity: Severity,
  confidence: number,
  limitations: string,
): Evidence {
  counter += 1;
  return {
    id: `${source}-${counter}`,
    source,
    category,
    observation,
    interpretation,
    severity,
    confidence,
    limitations,
  };
}

/* ---------------- Image forensics ---------------- */

export function imageForensics(
  probe: ImageProbe,
  detectedMime: string,
  sizeBytes: number,
): Evidence[] {
  const out: Evidence[] = [];
  const mp = (probe.width * probe.height) / 1_000_000;

  out.push(
    ev(
      "forensics",
      "Dimensions",
      `Decoded at ${probe.width}×${probe.height} px (${mp.toFixed(2)} MP).`,
      "Recorded for the file record. Dimensions alone carry no authenticity signal.",
      "info",
      0.99,
      "Reflects the decoded raster only, not any original capture size.",
    ),
  );

  // Common generator output sizes. This is a weak, explicitly-weak signal.
  const generatorSizes = [512, 768, 1024, 1152, 1216, 1344, 1536, 2048];
  const squareRound = probe.width === probe.height && generatorSizes.includes(probe.width);
  const bothRound = generatorSizes.includes(probe.width) && generatorSizes.includes(probe.height);
  if (squareRound || bothRound) {
    out.push(
      ev(
        "forensics",
        "Raster geometry",
        `Both dimensions match sizes commonly emitted by image generators (${probe.width}×${probe.height}).`,
        "Weakly consistent with generated output, but also produced by cropping, exporting, and many camera apps.",
        "low",
        0.35,
        "Purely statistical. Never treat a round resolution as proof on its own.",
      ),
    );
  }

  const bpp = probe.bytesPerPixel;
  if (detectedMime === "image/jpeg") {
    if (bpp < 0.08) {
      out.push(
        ev(
          "forensics",
          "Compression",
          `Stored at ${bpp.toFixed(3)} bytes per pixel — heavily compressed for a JPEG.`,
          "Consistent with repeated re-saving or download from a social platform. It also erases finer forensic detail.",
          "low",
          0.6,
          "Compression level is a property of the last save, not of the origin.",
        ),
      );
    } else if (bpp > 1.2) {
      out.push(
        ev(
          "forensics",
          "Compression",
          `Stored at ${bpp.toFixed(2)} bytes per pixel — unusually large for a JPEG.`,
          "Consistent with a high-quality export or an original camera file.",
          "info",
          0.6,
          "Large files can also be re-encoded from a small source.",
        ),
      );
    } else {
      out.push(
        ev(
          "forensics",
          "Compression",
          `Stored at ${bpp.toFixed(3)} bytes per pixel, within the ordinary JPEG range.`,
          "No compression anomaly detected in this build.",
          "info",
          0.55,
          "Only whole-file compression ratio is measured. No per-block ELA or quantisation-table matching is performed.",
        ),
      );
    }
  } else {
    out.push(
      ev(
        "forensics",
        "Compression",
        `${detectedMime} at ${(sizeBytes / 1024).toFixed(0)} KB, ${bpp.toFixed(3)} bytes per pixel.`,
        "Recorded for the file record.",
        "info",
        0.5,
        "Lossless and modern codecs give little compression-history signal.",
      ),
    );
  }

  out.push(
    ev(
      "forensics",
      "Pixel-level analysis",
      "Error-level analysis, noise-residual and PRNU sensor matching were not run.",
      "Absence of these tests is a coverage gap, not a clean bill of health.",
      "info",
      0.99,
      "These require a server-side forensic toolchain that is not configured here.",
    ),
  );

  return out;
}

/* ---------------- Audio forensics ---------------- */

export function audioForensics(
  probe: AudioProbe,
  detectedMime: string,
  sizeBytes: number,
): Evidence[] {
  const out: Evidence[] = [];
  const kbps = probe.durationSeconds > 0 ? (sizeBytes * 8) / probe.durationSeconds / 1000 : 0;

  out.push(
    ev(
      "forensics",
      "Container",
      `${detectedMime}, ${probe.durationSeconds.toFixed(2)}s${probe.sampleRate ? `, ${probe.sampleRate} Hz` : ""}${probe.channels ? `, ${probe.channels} ch` : ""}, ≈${kbps.toFixed(0)} kbps.`,
      "Baseline technical record of the clip.",
      "info",
      0.95,
      "Bitrate is averaged across the whole file.",
    ),
  );

  if (!probe.decoded) {
    out.push(
      ev(
        "forensics",
        "Waveform",
        "The waveform could not be decoded in this browser, so level-based checks did not run.",
        "No conclusion can be drawn from level statistics for this file.",
        "info",
        0.9,
        "Decoding depends on browser codec support.",
      ),
    );
    return out;
  }

  if (probe.silentRatio !== undefined) {
    if (probe.silentRatio > 0.35) {
      out.push(
        ev(
          "forensics",
          "Noise floor",
          `${(probe.silentRatio * 100).toFixed(1)}% of sampled points sit at digital silence.`,
          "A near-zero noise floor across much of a clip is typical of synthesised or heavily gated audio; it is also typical of studio recordings with noise removal.",
          "moderate",
          0.55,
          "Sampled, not exhaustive. Gating and denoising produce the same reading.",
        ),
      );
    } else {
      out.push(
        ev(
          "forensics",
          "Noise floor",
          `${(probe.silentRatio * 100).toFixed(1)}% of sampled points sit at digital silence — a normal room-tone profile.`,
          "Consistent with a real acoustic recording.",
          "info",
          0.5,
          "A convincing synthetic clip can also carry added room tone.",
        ),
      );
    }
  }

  if (probe.clippedRatio !== undefined && probe.clippedRatio > 0.01) {
    out.push(
      ev(
        "forensics",
        "Level",
        `${(probe.clippedRatio * 100).toFixed(2)}% of sampled points are at or beyond full scale.`,
        "Indicates aggressive limiting or a re-encode at a raised level; not specific to synthetic audio.",
        "low",
        0.6,
        "Clipping can be introduced at any point in a distribution chain.",
      ),
    );
  }

  if (probe.peakDbfs !== undefined && Number.isFinite(probe.peakDbfs) && probe.peakDbfs < -30) {
    out.push(
      ev(
        "forensics",
        "Level",
        `Peak level is ${probe.peakDbfs.toFixed(1)} dBFS — very quiet.`,
        "Low level reduces the reliability of every other audio measurement here.",
        "info",
        0.7,
        "Quiet material limits analysis rather than indicating manipulation.",
      ),
    );
  }

  out.push(
    ev(
      "forensics",
      "Spectral analysis",
      "Vocoder-artefact detection and speaker-model comparison were not run.",
      "Coverage gap: this build measures container and level properties only.",
      "info",
      0.99,
      "Dedicated speech-forensics models are not configured.",
    ),
  );

  return out;
}

/* ---------------- Video forensics ---------------- */

export function videoForensics(
  probe: VideoProbe,
  detectedMime: string,
  sizeBytes: number,
): Evidence[] {
  const out: Evidence[] = [];
  const kbps = probe.durationSeconds > 0 ? (sizeBytes * 8) / probe.durationSeconds / 1000 : 0;

  out.push(
    ev(
      "forensics",
      "Container",
      `${detectedMime}, ${probe.durationSeconds.toFixed(2)}s, ${probe.width}×${probe.height}, ≈${kbps.toFixed(0)} kbps.`,
      "Baseline technical record of the clip.",
      "info",
      0.95,
      "Per-stream codec detail requires ffprobe, which is not available in this runtime.",
    ),
  );

  out.push(
    ev(
      "forensics",
      "Frame sampling",
      `${probe.frameDataUrls.length} frame(s) were decoded and captured for inspection.`,
      probe.frameDataUrls.length
        ? "These frames are what the semantic pass actually looked at."
        : "No frame could be decoded, so visual inspection did not run on this file.",
      probe.frameDataUrls.length ? "info" : "info",
      0.9,
      "Sampled frames are not exhaustive; a manipulation between samples would be missed.",
    ),
  );

  if (probe.durationSeconds > 0 && probe.durationSeconds < 6) {
    out.push(
      ev(
        "forensics",
        "Duration",
        `Clip is only ${probe.durationSeconds.toFixed(1)}s long.`,
        "Short clips are common for generated video, and equally common for social re-shares. Mostly it means less material to analyse.",
        "low",
        0.35,
        "Duration is context, not evidence.",
      ),
    );
  }

  if (probe.width && probe.height) {
    const ratio = probe.width / probe.height;
    if (Math.abs(ratio - 1) < 0.01) {
      out.push(
        ev(
          "forensics",
          "Geometry",
          `Square frame (${probe.width}×${probe.height}).`,
          "Weakly consistent with generator output; also a standard social crop.",
          "low",
          0.3,
          "Purely statistical.",
        ),
      );
    }
  }

  out.push(
    ev(
      "forensics",
      "Temporal analysis",
      "GOP-structure inspection, per-frame ELA and optical-flow consistency were not run.",
      "Coverage gap: no server-side ffprobe/ffmpeg toolchain is configured in this runtime.",
      "info",
      0.99,
      "Frame-accurate temporal forensics needs a native media toolchain.",
    ),
  );

  return out;
}

/* ---------------- Metadata evidence ---------------- */

export function metadataEvidence(input: {
  hasExif: boolean;
  hasGps: boolean;
  software?: string | undefined;
  camera?: string | undefined;
  createdAt?: string | undefined;
  kind: string;
  notes: string[];
}): Evidence[] {
  const out: Evidence[] = [];

  if (input.camera) {
    out.push(
      ev(
        "metadata",
        "Capture device",
        `Camera recorded as "${input.camera}".`,
        "Consistent with a capture from a physical device. Device tags can be copied or forged, so this raises confidence without settling it.",
        "info",
        0.7,
        "EXIF is user-writable and survives editing.",
      ),
    );
  }

  if (input.software) {
    const generative =
      /(stable ?diffusion|midjourney|dall|firefly|sora|runway|comfyui|automatic1111|invokeai|flux|imagen|veo)/i.test(
        input.software,
      );
    const editor =
      /(photoshop|gimp|lightroom|affinity|capture one|snapseed|premiere|davinci|audacity)/i.test(
        input.software,
      );
    out.push(
      ev(
        "metadata",
        "Software tag",
        `Software field reads "${input.software}".`,
        generative
          ? "This names a generative tool directly. It is the strongest metadata signal available and should be treated seriously."
          : editor
            ? "An editing application touched this file. Editing is not manipulation, but the file is not a straight-from-camera original."
            : "A processing tool is named. On its own this is neutral.",
        generative ? "high" : editor ? "low" : "info",
        generative ? 0.85 : 0.6,
        "Software tags are freely writable and can be removed or spoofed.",
      ),
    );
  }

  if (input.hasGps) {
    out.push(
      ev(
        "metadata",
        "Location",
        "GPS coordinates are embedded in the file.",
        "Location data is typical of a phone capture and gives you something to corroborate against the claimed scene.",
        "info",
        0.8,
        "Coordinates can be edited; verify them against the visible scene.",
      ),
    );
  }

  if (!input.hasExif && input.kind === "image") {
    out.push(
      ev(
        "metadata",
        "Absent metadata",
        "No EXIF block is present in this image.",
        "Missing metadata is NOT proof of AI generation. Every major platform strips EXIF on upload, and so do screenshots and most messaging apps.",
        "info",
        0.95,
        "This observation is deliberately scored as neutral.",
      ),
    );
  }

  for (const note of input.notes) {
    out.push(
      ev(
        "metadata",
        "Container note",
        note,
        "Recorded for completeness. Absence of a metadata block is not itself a manipulation signal.",
        "info",
        0.8,
        "Parsing depth varies by container.",
      ),
    );
  }

  if (out.length === 0) {
    out.push(
      ev(
        "metadata",
        "Container",
        "No readable descriptive metadata was found.",
        "Nothing to weigh either way. Treated as neutral.",
        "info",
        0.7,
        "Missing metadata is never treated as evidence of manipulation.",
      ),
    );
  }

  return out;
}
