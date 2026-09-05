import { Panel } from "./Chrome";
import { UNAVAILABLE, type ScoreResult } from "@/lib/verimedia/types";

const SEGMENTS = 10;

export function RiskScore({ score }: { score: ScoreResult }) {
  const filled = Math.round((score.syntheticMediaRisk / 100) * SEGMENTS);
  const toneClass =
    score.syntheticMediaRisk <= 50 ? "text-ok" : score.syntheticMediaRisk <= 70 ? "text-signal" : "text-brand";
  const barClass =
    score.syntheticMediaRisk <= 50 ? "bg-ok" : score.syntheticMediaRisk <= 70 ? "bg-signal" : "bg-brand";

  return (
    <Panel className="p-7">
      <p className="label-mono">Synthetic Media Risk</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <span className={`font-display text-[7rem] font-black leading-[0.8] ${toneClass}`}>
          {score.syntheticMediaRisk}
        </span>
        <div className="text-right">
          <span className="block font-display text-lg font-extrabold uppercase tracking-wide text-signal">
            {score.verdict}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-dim">
            Confidence · {score.confidence.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex h-3 gap-px" role="img" aria-label={`Risk ${score.syntheticMediaRisk} out of 100`}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} className={`flex-1 ${i < filled ? barClass : "bg-line"}`} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-dim">
        <span>0 Authentic</span>
        <span>50</span>
        <span className="text-brand">100 Synthetic</span>
      </div>

      <div className="mt-6 space-y-2.5">
        {score.breakdown.map((row) => (
          <div key={row.source}>
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wide text-dim">
              <span>{row.label}</span>
              <span>
                {row.status === "ok"
                  ? `${Math.round(row.risk)} risk · ${Math.round(row.effectiveWeight * 100)}%`
                  : UNAVAILABLE}
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-line">
              <div
                className={`h-full ${row.status === "ok" ? barClass : "bg-line"}`}
                style={{ width: `${row.status === "ok" ? row.risk : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-dim">
        Nominal weights: metadata 15 · forensics 30 · gemini 30 · web 25.
        {score.renormalized
          ? " One or more stages did not run, so their weight was redistributed across the stages that did. Effective weights are shown above."
          : " All stages ran at nominal weight."}
      </p>
    </Panel>
  );
}

export function VerdictBands({ current }: { current: string }) {
  const bands = [
    { range: "0–25", name: "Likely Authentic" },
    { range: "26–50", name: "Mostly Authentic" },
    { range: "51–70", name: "Uncertain" },
    { range: "71–85", name: "Suspicious" },
    { range: "86–100", name: "High Synthetic-Media Risk" },
  ];
  return (
    <ul className="space-y-1.5">
      {bands.map((b) => (
        <li
          key={b.range}
          className={`flex justify-between font-mono text-[10px] uppercase tracking-wide ${
            b.name === current ? "text-signal" : "text-dim"
          }`}
        >
          <span>{b.name}</span>
          <span>{b.range}</span>
        </li>
      ))}
    </ul>
  );
}
