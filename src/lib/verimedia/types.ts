export type MediaKind = "image" | "audio" | "video";

export type EvidenceSource = "metadata" | "forensics" | "gemini" | "web";

export type Severity = "none" | "info" | "low" | "moderate" | "high";

export interface Evidence {
  id: string;
  source: EvidenceSource;
  category: string;
  observation: string;
  interpretation: string;
  severity: Severity;
  /** 0..1 — how much confidence we have in the observation itself. */
  confidence: number;
  limitations: string;
}

export type ComponentStatus = "ok" | "unavailable" | "error";

export interface ComponentResult {
  status: ComponentStatus;
  /** 0..100 risk contribution. Only meaningful when status === "ok". */
  risk: number;
  confidence: number;
  note: string;
  evidence: Evidence[];
}

export type VerdictBand =
  | "Likely Authentic"
  | "Mostly Authentic"
  | "Uncertain"
  | "Suspicious"
  | "High Synthetic-Media Risk";

export interface ScoreBreakdownRow {
  source: EvidenceSource;
  label: string;
  nominalWeight: number;
  effectiveWeight: number;
  risk: number;
  status: ComponentStatus;
}

export interface ScoreResult {
  syntheticMediaRisk: number;
  verdict: VerdictBand;
  confidence: number;
  breakdown: ScoreBreakdownRow[];
  renormalized: boolean;
}

export interface FileFacts {
  name: string;
  sizeBytes: number;
  declaredMime: string;
  detectedMime: string;
  kind: MediaKind;
  extension: string;
  sha256: string;
  width?: number | undefined;
  height?: number | undefined;
  durationSeconds?: number | undefined;
  sampleRate?: number | undefined;
  channels?: number | undefined;
}

export interface AnalysisReport {
  id: string;
  createdAt: number;
  origin: "upload" | "url";
  sourceLabel: string;
  file: FileFacts;
  components: Record<EvidenceSource, ComponentResult>;
  evidence: Evidence[];
  score: ScoreResult;
  explanation: string;
  metadataFields: Array<{ key: string; value: string }>;
  limitations: string[];
  previewDataUrl?: string | undefined;
}

export const UNAVAILABLE = "Unavailable — not configured";
