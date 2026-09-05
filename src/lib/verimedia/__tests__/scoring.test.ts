import { describe, expect, it } from "vitest";
import {
  NOMINAL_WEIGHTS,
  aggregateEvidence,
  calculateScore,
  explain,
  riskFromEvidence,
  verdictFor,
} from "../scoring";
import type { ComponentResult, Evidence, EvidenceSource, Severity } from "../types";

const evidence = (source: EvidenceSource, severity: Severity, confidence = 0.8): Evidence => ({
  id: `${source}-${severity}-${confidence}`,
  source,
  category: "Test",
  observation: "Observed something measurable.",
  interpretation: "It could mean one of several things.",
  severity,
  confidence,
  limitations: "Test fixture.",
});

const comp = (over: Partial<ComponentResult> = {}): ComponentResult => ({
  status: "ok",
  risk: 0,
  confidence: 0.8,
  evidence: [],
  note: "",
  ...over,
});

const all = (
  o: Partial<Record<EvidenceSource, ComponentResult>>,
): Record<EvidenceSource, ComponentResult> => ({
  metadata: comp({ status: "unavailable", confidence: 0 }),
  forensics: comp({ status: "unavailable", confidence: 0 }),
  gemini: comp({ status: "unavailable", confidence: 0 }),
  web: comp({ status: "unavailable", confidence: 0 }),
  ...o,
});

describe("weights", () => {
  it("sums to 1", () => {
    const total = Object.values(NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("verdict bands", () => {
  it.each([
    [0, "Likely Authentic"],
    [25, "Likely Authentic"],
    [26, "Mostly Authentic"],
    [50, "Mostly Authentic"],
    [51, "Uncertain"],
    [70, "Uncertain"],
    [71, "Suspicious"],
    [85, "Suspicious"],
    [86, "High Synthetic-Media Risk"],
    [100, "High Synthetic-Media Risk"],
  ])("maps %i to %s", (score, band) => {
    expect(verdictFor(score as number)).toBe(band);
  });
});

describe("calculateScore", () => {
  it("is deterministic", () => {
    const c = all({ forensics: comp({ risk: 60 }), metadata: comp({ risk: 10 }) });
    expect(calculateScore(c)).toEqual(calculateScore(c));
  });

  it("applies the documented weights when everything runs", () => {
    const c: Record<EvidenceSource, ComponentResult> = {
      metadata: comp({ risk: 100 }),
      forensics: comp({ risk: 0 }),
      gemini: comp({ risk: 0 }),
      web: comp({ risk: 0 }),
    };
    expect(calculateScore(c).syntheticMediaRisk).toBe(15);
  });

  it("renormalises rather than scoring an unavailable component as zero", () => {
    const c = all({ forensics: comp({ risk: 80 }) });
    const r = calculateScore(c);
    expect(r.renormalized).toBe(true);
    expect(r.syntheticMediaRisk).toBe(80);
    expect(r.breakdown.find((b) => b.source === "web")?.effectiveWeight).toBe(0);
    expect(r.breakdown.find((b) => b.source === "forensics")?.effectiveWeight).toBeCloseTo(1, 6);
  });

  it("never lets an unavailable component push the score down", () => {
    const full = calculateScore({
      metadata: comp({ risk: 90 }),
      forensics: comp({ risk: 90 }),
      gemini: comp({ risk: 90 }),
      web: comp({ risk: 90 }),
    });
    const partial = calculateScore(
      all({ metadata: comp({ risk: 90 }), forensics: comp({ risk: 90 }) }),
    );
    expect(partial.syntheticMediaRisk).toBe(full.syntheticMediaRisk);
    expect(partial.confidence).toBeLessThan(full.confidence);
  });

  it("returns a neutral 50 with zero confidence when nothing ran", () => {
    const r = calculateScore(all({}));
    expect(r.syntheticMediaRisk).toBe(50);
    expect(r.confidence).toBe(0);
    expect(r.verdict).toBe("Uncertain");
  });
});

describe("riskFromEvidence", () => {
  it("returns no risk and low confidence with no evidence", () => {
    expect(riskFromEvidence([])).toEqual({ risk: 0, confidence: 0.2 });
  });

  it("ignores informational evidence when scoring", () => {
    expect(riskFromEvidence([evidence("forensics", "info")]).risk).toBe(0);
  });

  it("is driven by the strongest signal", () => {
    const low = riskFromEvidence([evidence("forensics", "low")]).risk;
    const high = riskFromEvidence([evidence("forensics", "high")]).risk;
    expect(high).toBeGreaterThan(low);
  });

  it("scales risk by evidence confidence", () => {
    const sure = riskFromEvidence([evidence("forensics", "high", 1)]).risk;
    const unsure = riskFromEvidence([evidence("forensics", "high", 0.3)]).risk;
    expect(unsure).toBeLessThan(sure);
  });
});

describe("aggregateEvidence", () => {
  it("orders the most severe evidence first", () => {
    const c = all({
      metadata: comp({ evidence: [evidence("metadata", "low")] }),
      forensics: comp({ evidence: [evidence("forensics", "high"), evidence("forensics", "info")] }),
    });
    const list = aggregateEvidence(c);
    expect(list[0]?.severity).toBe("high");
    expect(list.at(-1)?.severity).toBe("info");
  });
});

describe("explain", () => {
  it("names the components that could not run", () => {
    const c = all({ forensics: comp({ risk: 10, evidence: [evidence("forensics", "low")] }) });
    const text = explain(calculateScore(c), c);
    expect(text).toMatch(/Web Context/);
    expect(text).toMatch(/10|score/i);
  });
});
