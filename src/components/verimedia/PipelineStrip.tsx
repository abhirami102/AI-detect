import { STAGES, type StageState } from "@/lib/verimedia/pipeline";

export function PipelineStrip({ states }: { states: StageState[] }) {
  const byStage = new Map(states.map((s) => [s.stage, s]));
  const runningIndex = STAGES.findIndex((s) => byStage.get(s)?.status === "running");
  const doneCount = STAGES.filter((s) =>
    ["done", "skipped"].includes(byStage.get(s)?.status ?? ""),
  ).length;
  const current = runningIndex >= 0 ? runningIndex + 1 : doneCount;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">
          Analysis Pipeline
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-signal">
          Stage {String(Math.max(current, 0)).padStart(2, "0")} / 07 ·{" "}
          {runningIndex >= 0 ? "Running" : doneCount === STAGES.length ? "Complete" : "Idle"}
        </p>
      </div>
      <div className="flex gap-1.5">
        {STAGES.map((stage) => {
          const status = byStage.get(stage)?.status ?? "pending";
          const cls =
            status === "done"
              ? "bg-ink"
              : status === "running"
                ? "bg-signal"
                : status === "skipped"
                  ? "bg-dim/40"
                  : status === "failed"
                    ? "bg-brand"
                    : "bg-line";
          return <div key={stage} className={`h-2 flex-1 ${cls}`} />;
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {STAGES.map((stage) => {
          const status = byStage.get(stage)?.status ?? "pending";
          const cls =
            status === "running"
              ? "text-signal"
              : status === "done"
                ? "text-ink"
                : status === "failed"
                  ? "text-brand"
                  : "text-dim";
          return (
            <span
              key={stage}
              className={`text-center font-mono text-[9px] uppercase tracking-wide ${cls}`}
            >
              {stage}
            </span>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1">
        {states
          .filter((s) => s.status !== "pending")
          .map((s) => (
            <li key={s.stage} className="flex justify-between font-mono text-[10px] text-dim">
              <span className="uppercase tracking-wide">{s.stage}</span>
              <span className="truncate pl-4 text-right">{s.detail}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
