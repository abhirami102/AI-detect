import { analyzeWithGemini } from "./gemini.functions";
import { fetchWebContext } from "./webcontext.functions";
import { extractMetadata } from "./metadata";
import { audioForensics, ev, imageForensics, metadataEvidence, videoForensics } from "./forensics";
import { probeAudio, probeImage, probeVideo, readHead, sha256Hex } from "./probe";
import { aggregateEvidence, calculateScore, explain, riskFromEvidence } from "./scoring";
import { extensionOf, sanitizeFilename, validateDimensions, validateDuration, validateHeader } from "./validate";
import { newReportId, saveReport } from "./store";
import type {
  AnalysisReport,
  ComponentResult,
  Evidence,
  EvidenceSource,
  FileFacts,
  MediaKind,
} from "./types";

export const STAGES = ["Validate", "Hash", "Metadata", "Forensics", "Gemini", "Web", "Score"] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StageState {
  stage: Stage;
  status: StageStatus;
  detail: string;
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
  }
}

const MAX_INLINE_BYTES = 6 * 1024 * 1024; // payload cap for the semantic pass

async function toBase64(blobOrDataUrl: Blob | string): Promise<string> {
  if (typeof blobOrDataUrl === "string") return blobOrDataUrl.split(",")[1] ?? "";
  const buffer = new Uint8Array(await blobOrDataUrl.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function runAnalysis(
  file: File,
  options: { origin: "upload" | "url"; sourceLabel: string; onStage: (s: StageState) => void },
): Promise<AnalysisReport> {
  const emit = (stage: Stage, status: StageStatus, detail: string) =>
    options.onStage({ stage, status, detail });

  /* ---- Validate ---- */
  emit("Validate", "running", "Reading file signature");
  const head = await readHead(file);
  const validation = validateHeader({
    name: file.name,
    sizeBytes: file.size,
    declaredMime: file.type,
    head,
  });
  if (!validation.ok || !validation.kind || !validation.detectedMime) {
    emit("Validate", "failed", "Rejected");
    throw new AnalysisError("This file did not pass validation.", validation.issues.map((i) => i.message));
  }
  const kind: MediaKind = validation.kind;
  emit("Validate", "done", `${validation.container} accepted`);

  /* ---- Hash ---- */
  emit("Hash", "running", "Computing SHA-256");
  const sha256 = await sha256Hex(file);
  emit("Hash", "done", `${sha256.slice(0, 16)}…`);

  /* ---- Metadata ---- */
  emit("Metadata", "running", "Parsing container metadata");
  const meta = extractMetadata(head, validation.detectedMime);
  const metaEvidence = metadataEvidence({ ...meta, kind });
  const metaScore = riskFromEvidence(metaEvidence);
  const metadataComponent: ComponentResult = {
    status: "ok",
    risk: metaScore.risk,
    confidence: metaScore.confidence,
    note: meta.hasExif ? "Metadata block present and parsed." : "No EXIF block — recorded as neutral.",
    evidence: metaEvidence,
  };
  emit("Metadata", "done", `${meta.fields.length} field(s)`);

  /* ---- Forensics ---- */
  emit("Forensics", "running", "Measuring container and signal properties");
  let forensicEvidence: Evidence[] = [];
  let previewDataUrl: string | undefined;
  let semanticPayloads: string[] = [];
  const facts: FileFacts = {
    name: sanitizeFilename(file.name),
    sizeBytes: file.size,
    declaredMime: file.type || "(none reported)",
    detectedMime: validation.detectedMime,
    kind,
    extension: extensionOf(file.name) || validation.extension || "",
    sha256,
  };

  try {
    if (kind === "image") {
      const probe = await probeImage(file);
      const dimIssues = validateDimensions(probe.width, probe.height);
      if (dimIssues.length) {
        emit("Forensics", "failed", "Rejected");
        throw new AnalysisError("This image did not pass validation.", dimIssues.map((i) => i.message));
      }
      facts.width = probe.width;
      facts.height = probe.height;
      previewDataUrl = probe.previewDataUrl;
      forensicEvidence = imageForensics(probe, validation.detectedMime, file.size);
      semanticPayloads = file.size <= MAX_INLINE_BYTES ? [await toBase64(file)] : [await toBase64(probe.previewDataUrl)];
    } else if (kind === "audio") {
      const probe = await probeAudio(file);
      const durIssues = validateDuration(kind, probe.durationSeconds);
      if (durIssues.length) {
        emit("Forensics", "failed", "Rejected");
        throw new AnalysisError("This audio did not pass validation.", durIssues.map((i) => i.message));
      }
      facts.durationSeconds = probe.durationSeconds;
      facts.sampleRate = probe.sampleRate;
      facts.channels = probe.channels;
      forensicEvidence = audioForensics(probe, validation.detectedMime, file.size);
      semanticPayloads = file.size <= MAX_INLINE_BYTES ? [await toBase64(file)] : [];
    } else {
      const probe = await probeVideo(file);
      const durIssues = validateDuration(kind, probe.durationSeconds);
      if (durIssues.length) {
        emit("Forensics", "failed", "Rejected");
        throw new AnalysisError("This video did not pass validation.", durIssues.map((i) => i.message));
      }
      facts.durationSeconds = probe.durationSeconds;
      facts.width = probe.width;
      facts.height = probe.height;
      previewDataUrl = probe.previewDataUrl || undefined;
      forensicEvidence = videoForensics(probe, validation.detectedMime, file.size);
      semanticPayloads = await Promise.all(probe.frameDataUrls.map((f) => toBase64(f)));
    }
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError("The media could not be decoded by this browser.", [(error as Error).message]);
  }

  const forensicScore = riskFromEvidence(forensicEvidence);
  const forensicsComponent: ComponentResult = {
    status: "ok",
    risk: forensicScore.risk,
    confidence: forensicScore.confidence,
    note: "Container and signal-level measurements only. No pixel-level or temporal forensic toolchain is configured.",
    evidence: forensicEvidence,
  };
  emit("Forensics", "done", `${forensicEvidence.length} signal(s)`);

  /* ---- Gemini ---- */
  emit("Gemini", "running", "Semantic pass");
  let geminiComponent: ComponentResult;
  if (semanticPayloads.length === 0) {
    geminiComponent = {
      status: "unavailable",
      risk: 0,
      confidence: 0,
      note: "No payload small enough to send for semantic analysis (limit 6 MB, or no frame could be decoded).",
      evidence: [],
    };
    emit("Gemini", "skipped", "No sendable payload");
  } else {
    const factsLine = `${facts.detectedMime}, ${(facts.sizeBytes / 1024 / 1024).toFixed(2)} MB${
      facts.width ? `, ${facts.width}x${facts.height}` : ""
    }${facts.durationSeconds ? `, ${facts.durationSeconds.toFixed(1)}s` : ""}, EXIF ${meta.hasExif ? "present" : "absent"}`;
    const result = await analyzeWithGemini({
      data: { kind, mime: facts.detectedMime, payloads: semanticPayloads, fileFacts: factsLine },
    });
    if (result.status === "ok") {
      const gEvidence = result.observations.map((o) =>
        ev(
          "gemini",
          o.category || "Semantic",
          o.observation,
          o.interpretation,
          o.severity,
          typeof o.confidence === "number" ? o.confidence : 0.5,
          "Model observation. The model does not set the risk score; it only contributes evidence.",
        ),
      );
      const gScore = riskFromEvidence(gEvidence);
      geminiComponent = {
        status: "ok",
        risk: gScore.risk,
        confidence: Math.min(gScore.confidence, result.overallConfidence || gScore.confidence),
        note: `${result.model ?? "model"} returned ${gEvidence.length} observation(s). ${result.limitations.join(" ")}`.trim(),
        evidence: gEvidence,
      };
      emit("Gemini", "done", `${gEvidence.length} observation(s)`);
    } else {
      geminiComponent = {
        status: result.status === "unavailable" ? "unavailable" : "error",
        risk: 0,
        confidence: 0,
        note: result.message,
        evidence: [],
      };
      emit("Gemini", "skipped", result.status === "unavailable" ? "Not configured" : "Did not run");
    }
  }

  /* ---- Web context ---- */
  emit("Web", "running", "Looking for corroborating sources");
  const web = await fetchWebContext({ data: { query: facts.name } });
  const webComponent: ComponentResult =
    web.status === "ok"
      ? (() => {
          const wEvidence = web.results.map((r) =>
            ev(
              "web",
              "Source",
              `${r.title} — ${r.snippet}`,
              `Traceable source: ${r.url}. Read it before relying on it.`,
              "info",
              0.5,
              "Search grounding surfaces text matches, not image matches.",
            ),
          );
          const wScore = riskFromEvidence(wEvidence);
          return {
            status: "ok" as const,
            risk: wScore.risk,
            confidence: wScore.confidence,
            note: web.message,
            evidence: wEvidence,
          };
        })()
      : { status: "unavailable", risk: 0, confidence: 0, note: web.message, evidence: [] };
  emit("Web", web.status === "ok" ? "done" : "skipped", web.status === "ok" ? `${web.results.length} result(s)` : "Not configured");

  /* ---- Score ---- */
  emit("Score", "running", "Aggregating evidence");
  const components: Record<EvidenceSource, ComponentResult> = {
    metadata: metadataComponent,
    forensics: forensicsComponent,
    gemini: geminiComponent,
    web: webComponent,
  };
  const score = calculateScore(components);
  emit("Score", "done", `${score.syntheticMediaRisk}/100 · ${score.verdict}`);

  const limitations = [
    "Every signal here is probabilistic. This score is a reading, not a verdict.",
    "Missing metadata is never treated as proof of AI generation.",
    "No bounding boxes, heatmaps, or pixel-level detections are produced — this build does not compute them.",
    "Reverse image search is not implemented and was not performed.",
    "Server-side ffmpeg/ffprobe and cloud object storage are not available in this runtime, so codec-level and frame-accurate forensics are out of scope.",
    "Your media is analysed in your browser and is never uploaded to storage. Only small excerpts are sent to the model when the semantic pass runs.",
    ...new Set(Object.values(components).flatMap((c) => c.evidence.map((e) => e.limitations))),
  ];

  const report: AnalysisReport = {
    id: newReportId(),
    createdAt: Date.now(),
    origin: options.origin,
    sourceLabel: options.sourceLabel,
    file: facts,
    components,
    evidence: aggregateEvidence(components),
    score,
    explanation: explain(score, components),
    metadataFields: meta.fields,
    limitations,
    previewDataUrl,
  };

  saveReport(report);
  return report;
}

export async function fetchRemoteMedia(url: string): Promise<File> {
  const res = await fetch(url, { mode: "cors", redirect: "follow" });
  if (!res.ok) throw new AnalysisError("The URL could not be fetched.", [`The host returned HTTP ${res.status}.`]);
  const blob = await res.blob();
  const name = sanitizeFilename(new URL(url).pathname.split("/").pop() || "remote-media");
  return new File([blob], name, { type: blob.type });
}
