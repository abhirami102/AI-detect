import type {
  ComponentResult,
  Evidence,
  EvidenceSource,
  ScoreBreakdownRow,
  ScoreResult,
  Severity,
  VerdictBand,
} from "./types";

export const NOMINAL_WEIGHTS: Record<EvidenceSource, number> = {
  metadata: 0.15,
  forensics: 0.3,
  gemini: 0.3,
  web: 0.25,
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  metadata: "Metadata",
  forensics: "Forensics",
  gemini: "Gemini",
  web: "Web Context",
};

export const SEVERITY_RISK: Record<Severity, number> = {
  none: 0,
  info: 0,
  low: 20,
  moderate: 50,
  high: 80,
};

export function verdictFor(score: number): VerdictBand {
  if (score <= 25) return "Likely Authentic";
  if (score <= 50) return "Mostly Authentic";
  if (score <= 70) return "Uncertain";
  if (score <= 85) return "Suspicious";
  return "High Synthetic-Media Risk";
}

const ORDER: EvidenceSource[] = ["metadata", "forensics", "gemini", "web"];

/**
 * Deterministic risk aggregation.
 *
 * syntheticMediaRisk = metadata×15% + forensics×30% + gemini×30% + web×25%
 *
 * When a component is unavailable (e.g. web context is not configured) its
 * weight is redistributed proportionally across the available components
 * rather than being silently scored as 0 — an absent signal is not evidence
 * of authenticity, and it is not evidence of manipulation either.
 */
export function calculateScore(components: Record<EvidenceSource, ComponentResult>): ScoreResult {
  const available = ORDER.filter((s) => components[s]?.status === "ok");
  const availableWeight = available.reduce((sum, s) => sum + NOMINAL_WEIGHTS[s], 0);
  const renormalized = available.length > 0 && availableWeight < 0.999;

  const breakdown: ScoreBreakdownRow[] = ORDER.map((source) => {
    const c = components[source];
    const isOk = c?.status === "ok";
    const effectiveWeight = isOk && availableWeight > 0 ? NOMINAL_WEIGHTS[source] / availableWeight : 0;
    return {
      source,
      label: SOURCE_LABELS[source],
      nominalWeight: NOMINAL_WEIGHTS[source],
      effectiveWeight,
      risk: isOk ? clamp(c.risk) : 0,
      status: c?.status ?? "unavailable",
    };
  });

  const raw = breakdown.reduce((sum, row) => sum + row.risk * row.effectiveWeight, 0);
  const syntheticMediaRisk = available.length === 0 ? 50 : Math.round(clamp(raw));

  const confidenceBase =
    available.length === 0
      ? 0
      : available.reduce(
          (sum, s) => sum + (components[s]!.confidence ?? 0) * (NOMINAL_WEIGHTS[s] / availableWeight),
          0,
        );
  // Coverage penalty: fewer running components means lower confidence.
  const coverage = availableWeight;
  const confidence = Math.round(clamp(confidenceBase * coverage * 100)) / 100;

  return {
    syntheticMediaRisk,
    // With no component available there is nothing to judge: report uncertainty
    // rather than letting the neutral placeholder read as a leaning verdict.
    verdict: available.length === 0 ? "Uncertain" : verdictFor(syntheticMediaRisk),
    confidence,
    breakdown,
    renormalized,
  };
}

/** Component risk derived from its own evidence, weighted by evidence confidence. */
export function riskFromEvidence(evidence: Evidence[]): { risk: number; confidence: number } {
  if (evidence.length === 0) return { risk: 0, confidence: 0.2 };
  const scored = evidence.filter((e) => e.severity !== "info");
  if (scored.length === 0) {
    return { risk: 0, confidence: mean(evidence.map((e) => e.confidence)) };
  }
  // Highest-severity signal dominates; supporting signals nudge it upward.
  const values = scored.map((e) => SEVERITY_RISK[e.severity] * clampUnit(e.confidence));
  const peak = Math.max(...values);
  const support = (values.reduce((a, b) => a + b, 0) - peak) / Math.max(scored.length - 1, 1);
  const risk = clamp(peak + support * 0.25);
  return { risk, confidence: mean(scored.map((e) => e.confidence)) };
}

export function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clampUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function aggregateEvidence(components: Record<EvidenceSource, ComponentResult>): Evidence[] {
  const rank: Record<Severity, number> = { high: 0, moderate: 1, low: 2, info: 3, none: 4 };
  return ORDER.flatMap((s) => components[s]?.evidence ?? []).sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.confidence - a.confidence,
  );
}

export function explain(score: ScoreResult, components: Record<EvidenceSource, ComponentResult>): string {
  const strongest = aggregateEvidence(components).find((e) => e.severity === "high" || e.severity === "moderate");
  const missing = ORDER.filter((s) => components[s]?.status !== "ok").map((s) => SOURCE_LABELS[s]);

  const head =
    score.verdict === "Likely Authentic" || score.verdict === "Mostly Authentic"
      ? `Nothing in the signals we were able to read points to synthetic generation. The file scores ${score.syntheticMediaRisk}/100.`
      : score.verdict === "Uncertain"
        ? `The signals are mixed. The file scores ${score.syntheticMediaRisk}/100, which is not enough to call it either way.`
        : `Several signals are inconsistent with an untouched original. The file scores ${score.syntheticMediaRisk}/100.`;

  const detail = strongest
    ? ` The strongest single signal is: ${strongest.observation} That may mean: ${strongest.interpretation}`
    : " No individual signal rose above background level.";

  const gap = missing.length
    ? ` ${missing.join(" and ")} did not run, so this score covers only part of the picture.`
    : "";

  return `${head}${detail}${gap} A score is a reading, not a verdict — weigh it against sourcing and context.`;
}
