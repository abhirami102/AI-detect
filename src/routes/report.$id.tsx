import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel, SectionLabel, SiteFooter, SiteHeader, Tag } from "@/components/verimedia/Chrome";
import { ComponentSection, EvidenceCard } from "@/components/verimedia/EvidenceCard";
import { RiskScore, VerdictBands } from "@/components/verimedia/RiskScore";
import { getReport } from "@/lib/verimedia/store";
import type { AnalysisReport } from "@/lib/verimedia/types";

export const Route = createFileRoute("/report/$id")({
  head: () => ({
    meta: [
      { title: "Verification report — VeriMedia AI" },
      {
        name: "description",
        content:
          "A full synthetic-media verification report: risk score, verdict, evidence cards, metadata, forensics, semantic analysis, file hash and stated limitations.",
      },
      { property: "og:title", content: "Verification report — VeriMedia AI" },
      {
        property: "og:description",
        content: "Risk score, evidence and limitations for one analysed file.",
      },
      { property: "og:type", content: "article" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setReport(getReport(id) ?? null);
    setLoaded(true);
  }, [id]);

  const topEvidence = useMemo(() => report?.evidence.slice(0, 4) ?? [], [report]);

  if (!loaded) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="px-6 md:px-10">
          <p className="font-mono text-xs uppercase tracking-widest text-dim">Loading report…</p>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="px-6 md:px-10">
          <SectionLabel>Report not found</SectionLabel>
          <Panel className="p-6">
            <p className="text-sm leading-relaxed text-dim">
              Reports are held for the current browsing session only — media and results are never
              written to storage. If you reopened this link in a new tab or a new session, the
              report is gone and the file has to be analysed again.
            </p>
            <Link
              to="/analyze"
              className="clip-notch mt-5 inline-block bg-brand px-5 py-3 font-display text-xs font-bold uppercase tracking-widest text-primary-foreground"
            >
              Analyze media
            </Link>
          </Panel>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { file, score, components } = report;

  const exportReport = () => {
    const blob = new Blob(
      [JSON.stringify(report, (k, v) => (k === "previewDataUrl" ? undefined : v), 2)],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verimedia-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="px-6 pb-4 md:px-10">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="h-px w-10 bg-signal" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-dim">
            Result · {file.name}
          </p>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={exportReport}
              className="clip-notch border border-ink/30 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-widest transition hover:bg-foreground/10"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="clip-notch border border-ink/30 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-widest transition hover:bg-foreground/10"
            >
              Print
            </button>
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <RiskScore score={score} />
            <Panel className="p-6">
              <p className="label-mono">Verdict bands</p>
              <div className="mt-3">
                <VerdictBands current={score.verdict} />
              </div>
            </Panel>
            {report.previewDataUrl ? (
              <Panel className="p-4">
                <p className="label-mono mb-3">
                  {file.kind === "video" ? "Sampled frame" : "Analysed media"}
                </p>
                <img
                  src={report.previewDataUrl}
                  alt="Analysed media"
                  className="w-full object-contain"
                />
              </Panel>
            ) : null}
          </div>

          <div className="space-y-4 lg:col-span-7">
            <Panel className="p-6">
              <p className="label-mono">In plain language</p>
              <p className="mt-2 text-sm leading-relaxed">{report.explanation}</p>
            </Panel>
            {topEvidence.map((e) => (
              <EvidenceCard key={e.id} evidence={e} />
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <ComponentSection source="metadata" result={components.metadata} title="Metadata" />
          <ComponentSection source="forensics" result={components.forensics} title="Forensics" />
          <ComponentSection
            source="gemini"
            result={components.gemini}
            title="Gemini · semantic pass"
          />
          <ComponentSection source="web" result={components.web} title="Web context" />
        </div>

        {report.metadataFields.length ? (
          <section className="mt-14">
            <SectionLabel>Raw metadata fields</SectionLabel>
            <Panel className="p-5">
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {report.metadataFields.map((f) => (
                  <div
                    key={`${f.key}-${f.value}`}
                    className="flex justify-between gap-4 border-b border-line pb-1"
                  >
                    <dt className="font-mono text-[10px] uppercase tracking-wide text-dim">
                      {f.key}
                    </dt>
                    <dd className="truncate font-mono text-[11px] text-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </section>
        ) : null}

        <section className="mt-14">
          <SectionLabel>File record</SectionLabel>
          <div className="clip-notch border border-line bg-panel2 p-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="label-mono">File</p>
                <p className="mt-1 font-mono text-sm">
                  {file.name} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="mt-1 font-mono text-[11px] text-dim">
                  {file.detectedMime}
                  {file.width ? ` · ${file.width}×${file.height}` : ""}
                  {file.durationSeconds ? ` · ${file.durationSeconds.toFixed(2)}s` : ""}
                  {file.sampleRate ? ` · ${file.sampleRate} Hz` : ""}
                </p>
                <p className="mt-1 font-mono text-[11px] text-dim">
                  Browser reported: {file.declaredMime} (not trusted)
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="label-mono">SHA-256</p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground/80">
                  {file.sha256}
                </p>
                <p className="mt-3 label-mono">Source</p>
                <p className="mt-1 break-all font-mono text-[11px] text-dim">
                  {report.origin === "url" ? report.sourceLabel : "Local upload"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <SectionLabel>Limitations &amp; uncertainty</SectionLabel>
          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Tag tone="signal">Uncertainty notice</Tag>
              <p className="text-xs text-dim">
                Confidence for this report is {score.confidence.toFixed(2)} out of 1.00. Treat
                anything below 0.60 as a partial picture.
              </p>
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-dim">
              {report.limitations.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
          </Panel>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
