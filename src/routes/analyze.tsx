import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Panel, SectionLabel, SiteFooter, SiteHeader } from "@/components/verimedia/Chrome";
import { PipelineStrip } from "@/components/verimedia/PipelineStrip";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  MAX_VIDEO_SECONDS,
  SUPPORTED_FORMATS,
} from "@/lib/verimedia/constants";
import {
  AnalysisError,
  STAGES,
  fetchRemoteMedia,
  runAnalysis,
  type StageState,
} from "@/lib/verimedia/pipeline";
import { checkMediaUrl } from "@/lib/verimedia/url-safety";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze media — VeriMedia AI" },
      {
        name: "description",
        content:
          "Upload an image, audio clip or video, or paste a media URL, and watch each validation, hashing, metadata, forensics and scoring stage run.",
      },
      { property: "og:title", content: "Analyze media — VeriMedia AI" },
      { property: "og:description", content: "Validate, hash and analyse media in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzePage,
});

const initialStages = (): StageState[] =>
  STAGES.map((stage) => ({ stage, status: "pending" as const, detail: "" }));

function AnalyzePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<StageState[]>(initialStages);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");

  const onStage = useCallback((next: StageState) => {
    setStages((prev) => prev.map((s) => (s.stage === next.stage ? next : s)));
  }, []);

  const start = useCallback(
    async (candidate: File, origin: "upload" | "url", sourceLabel: string) => {
      setBusy(true);
      setErrors([]);
      setErrorTitle("");
      setStages(initialStages());
      setFile(candidate);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(candidate);
      setPreviewUrl(url);

      try {
        const report = await runAnalysis(candidate, { origin, sourceLabel, onStage });
        navigate({ to: "/report/$id", params: { id: report.id } });
      } catch (error) {
        if (error instanceof AnalysisError) {
          setErrorTitle(error.message);
          setErrors(error.issues);
        } else {
          setErrorTitle("The analysis could not be completed.");
          setErrors([(error as Error).message]);
        }
        setBusy(false);
      }
    },
    [navigate, onStage, previewUrl],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const first = files?.[0];
      if (!first) return;
      void start(first, "upload", first.name);
    },
    [start],
  );

  const handleUrl = useCallback(async () => {
    const check = checkMediaUrl(urlValue);
    if (!check.ok || !check.url) {
      setErrorTitle("That URL was refused.");
      setErrors([check.reason ?? "Unknown reason."]);
      return;
    }
    setBusy(true);
    setErrors([]);
    setErrorTitle("");
    try {
      const remote = await fetchRemoteMedia(check.url.toString());
      await start(remote, "url", check.url.toString());
    } catch (error) {
      setErrorTitle("The media at that URL could not be retrieved.");
      setErrors([
        error instanceof AnalysisError ? error.issues.join(" ") : (error as Error).message,
        "Many hosts block cross-origin fetches. If this keeps failing, download the file and upload it instead.",
      ]);
      setBusy(false);
    }
  }, [start, urlValue]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="px-6 md:px-10">
        <SectionLabel>Analyze / Upload or link media</SectionLabel>

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy) handleFiles(e.dataTransfer.files);
              }}
              className={`clip-notch relative overflow-hidden border-2 border-dashed bg-panel/40 p-8 transition-colors ${
                dragging ? "border-signal" : "border-brand/60"
              }`}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 -skew-x-12 bg-brand/10" />
              <p className="font-display text-base font-extrabold uppercase tracking-wide">
                Drop media to verify
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-dim">
                max {MAX_FILE_BYTES / 1024 / 1024}MB · video up to {MAX_VIDEO_SECONDS}s ·{" "}
                {SUPPORTED_FORMATS.map((f) => f.label).join(" · ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="clip-notch bg-brand px-5 py-3 font-display text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  Choose File
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  accept={ACCEPT_ATTRIBUTE}
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>

            <Panel className="p-6">
              <label htmlFor="media-url" className="label-mono">
                Analyze a media URL
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  id="media-url"
                  type="url"
                  value={urlValue}
                  disabled={busy}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://example.com/clip.mp4"
                  className="min-w-0 flex-1 border border-line bg-background px-3 py-3 font-mono text-xs text-foreground outline-none placeholder:text-dim focus:border-signal"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleUrl()}
                  className="clip-notch border border-ink/30 px-5 py-3 font-display text-xs font-bold uppercase tracking-widest transition hover:bg-foreground/10 disabled:opacity-40"
                >
                  Analyze URL
                </button>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-dim">
                URLs are checked against private, loopback, link-local and cloud-metadata ranges
                before any request is made. The fetch happens from your browser, so hosts that block
                cross-origin requests will refuse.
              </p>
            </Panel>

            {errorTitle ? (
              <Panel className="border-brand p-5">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-brand">
                  {errorTitle}
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-dim">
                  {errors.map((e) => (
                    <li key={e}>· {e}</li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>

          <div className="space-y-5 lg:col-span-5">
            <Panel className="p-6">
              <p className="label-mono">Selected media</p>
              {file ? (
                <>
                  <div className="mt-3 border border-line bg-background p-3">
                    {file.type.startsWith("image/") && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Selected media preview"
                        className="max-h-64 w-full object-contain"
                      />
                    ) : file.type.startsWith("video/") && previewUrl ? (
                      <video src={previewUrl} controls className="max-h-64 w-full" />
                    ) : previewUrl ? (
                      <audio src={previewUrl} controls className="w-full" />
                    ) : null}
                  </div>
                  <dl className="mt-4 space-y-1 font-mono text-[10px] uppercase tracking-wide text-dim">
                    <div className="flex justify-between gap-4">
                      <dt>Name</dt>
                      <dd className="truncate text-foreground">{file.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Size</dt>
                      <dd className="text-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Reported type</dt>
                      <dd className="text-foreground">{file.type || "none"}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-dim">
                  Nothing selected yet. Drop a file or choose one to begin.
                </p>
              )}
            </Panel>

            <Panel className="p-6">
              <PipelineStrip states={stages} />
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
