import { Panel, Tag } from "./Chrome";
import type { ComponentResult, Evidence, EvidenceSource } from "@/lib/verimedia/types";

const SOURCE_TONE: Record<EvidenceSource, "brand" | "signal" | "dim" | "ink"> = {
  forensics: "brand",
  gemini: "signal",
  metadata: "dim",
  web: "ink",
};

const SOURCE_NAME: Record<EvidenceSource, string> = {
  forensics: "Forensics",
  gemini: "Gemini",
  metadata: "Metadata",
  web: "Web",
};

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <Panel className="flex gap-4 p-5">
      <Tag tone={SOURCE_TONE[evidence.source]}>{SOURCE_NAME[evidence.source]}</Tag>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold">{evidence.category}</p>
        <p className="mt-1 text-xs leading-relaxed text-dim">
          <span className="text-foreground/80">Observation:</span> {evidence.observation}{" "}
          <span className="text-foreground/80">Interpretation:</span> {evidence.interpretation}
        </p>
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wide text-dim">
          Severity {evidence.severity} · Confidence {evidence.confidence.toFixed(2)}
        </p>
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-dim/70">
          Limitation: {evidence.limitations}
        </p>
      </div>
    </Panel>
  );
}

export function UnavailableCard({ source, note }: { source: EvidenceSource; note: string }) {
  return (
    <Panel dashed className="flex items-start gap-4 p-5">
      <Tag>{SOURCE_NAME[source]}</Tag>
      <p className="text-xs leading-relaxed text-dim">{note}</p>
    </Panel>
  );
}

export function ComponentSection({
  source,
  result,
  title,
}: {
  source: EvidenceSource;
  result: ComponentResult;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-extrabold uppercase tracking-wide">{title}</h3>
        <p className="font-mono text-[10px] uppercase tracking-wide text-dim">
          {result.status === "ok"
            ? `Risk ${Math.round(result.risk)} · Confidence ${result.confidence.toFixed(2)}`
            : result.status === "unavailable"
              ? "Unavailable — not configured"
              : "Did not run"}
        </p>
      </div>
      {result.note ? <p className="text-xs leading-relaxed text-dim">{result.note}</p> : null}
      {result.evidence.length ? (
        result.evidence.map((e) => <EvidenceCard key={e.id} evidence={e} />)
      ) : (
        <UnavailableCard
          source={source}
          note={result.note || "No signals recorded for this stage."}
        />
      )}
    </section>
  );
}
