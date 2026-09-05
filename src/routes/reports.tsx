import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, SectionLabel, SiteFooter, SiteHeader, Tag } from "@/components/verimedia/Chrome";
import { clearReports, listReports } from "@/lib/verimedia/store";
import type { AnalysisReport } from "@/lib/verimedia/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Session reports — VeriMedia AI" },
      {
        name: "description",
        content:
          "Every verification report produced in this browsing session, with score, verdict and file hash. Nothing is stored beyond the session.",
      },
      { property: "og:title", content: "Session reports — VeriMedia AI" },
      { property: "og:description", content: "Your verification history for this session only." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [reports, setReports] = useState<AnalysisReport[]>([]);

  useEffect(() => {
    setReports(listReports());
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-6 md:px-10">
        <SectionLabel>Reports / This session only</SectionLabel>

        {reports.length === 0 ? (
          <Panel dashed className="p-6">
            <p className="text-sm leading-relaxed text-dim">
              No reports yet in this session.{" "}
              <Link to="/analyze" className="text-signal underline">
                Analyze a file
              </Link>{" "}
              to create one.
            </p>
          </Panel>
        ) : (
          <>
            <div className="space-y-3">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  to="/report/$id"
                  params={{ id: r.id }}
                  className="clip-notch block border border-line bg-panel p-5 transition hover:border-signal"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-display text-3xl font-black">{Math.round(r.score.syntheticMediaRisk)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold">{r.file.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-dim">
                        {r.file.kind} · {r.file.detectedMime} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="ml-auto">
                      <Tag tone={r.score.syntheticMediaRisk >= 60 ? "brand" : r.score.syntheticMediaRisk >= 40 ? "signal" : "dim"}>
                        {r.score.verdict}
                      </Tag>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                clearReports();
                setReports([]);
              }}
              className="clip-notch mt-6 border border-brand/60 px-5 py-3 font-display text-[10px] font-bold uppercase tracking-widest text-brand transition hover:bg-brand/10"
            >
              Clear session reports
            </button>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
