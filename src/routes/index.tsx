import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader, Panel, SectionLabel } from "@/components/verimedia/Chrome";
import { SUPPORTED_FORMATS } from "@/lib/verimedia/constants";
import { NOMINAL_WEIGHTS, SOURCE_LABELS } from "@/lib/verimedia/scoring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeriMedia AI — Verify images, audio and video before you share" },
      {
        name: "description",
        content:
          "VeriMedia AI reads real signals in an image, audio clip or video and returns a transparent 0–100 synthetic-media risk score with the evidence behind it.",
      },
      { property: "og:title", content: "VeriMedia AI — Media verification for journalists" },
      {
        property: "og:description",
        content:
          "Transparent synthetic-media risk scoring with observation and interpretation kept separate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const imageFormats = SUPPORTED_FORMATS.filter((f) => f.kind === "image").map((f) => f.label);
  const audioFormats = SUPPORTED_FORMATS.filter((f) => f.kind === "audio").map((f) => f.label);
  const videoFormats = SUPPORTED_FORMATS.filter((f) => f.kind === "video").map((f) => f.label);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="px-6 pt-8 md:px-10">
        <SectionLabel>Media Forensics / Verification Engine</SectionLabel>

        <h1 className="headline text-[clamp(2.75rem,9vw,8rem)]">
          Trust
          <br />
          <span className="text-brand">Nothing</span>{" "}
          <span className="relative inline-block">
            <span className="text-signal">Unread</span>
            <span className="absolute -bottom-2 left-0 right-0 h-2 -skew-x-12 bg-brand" />
          </span>
        </h1>

        <div className="mt-10 grid items-end gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-lg leading-relaxed text-foreground/85">
              Detect, explain, and document AI-generated or manipulated{" "}
              <span className="text-signal">images</span>,{" "}
              <span className="text-signal">audio</span>, and{" "}
              <span className="text-signal">video</span> before you trust or share them.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[imageFormats, audioFormats, videoFormats].map((group) => (
                <span
                  key={group.join()}
                  className="border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-dim"
                >
                  {group.join(" · ")}
                </span>
              ))}
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="clip-notch relative overflow-hidden border-2 border-dashed border-brand/60 bg-panel/40 p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 -skew-x-12 bg-brand/10" />
              <p className="font-display text-base font-extrabold uppercase tracking-wide">
                Drop media to verify
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-dim">
                or paste a media URL · max 50MB · 120s video
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/analyze"
                  className="clip-notch bg-brand px-5 py-3 font-display text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
                >
                  Analyze Media
                </Link>
                <Link
                  to="/method"
                  className="clip-notch border border-ink/30 px-5 py-3 font-display text-xs font-bold uppercase tracking-widest text-foreground transition hover:bg-foreground/10"
                >
                  How scoring works
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14 px-6 md:px-10">
        <SectionLabel tone="signal">What the score is made of</SectionLabel>
        <div className="grid gap-4 md:grid-cols-4">
          {(Object.keys(NOMINAL_WEIGHTS) as Array<keyof typeof NOMINAL_WEIGHTS>).map((source) => (
            <Panel key={source} className="p-5">
              <p className="label-mono">{SOURCE_LABELS[source]}</p>
              <p className="mt-2 font-display text-3xl font-black">
                {Math.round(NOMINAL_WEIGHTS[source] * 100)}%
              </p>
              <p className="mt-2 text-xs leading-relaxed text-dim">
                {source === "metadata"
                  ? "EXIF, container tags, software fields. Missing metadata is never treated as proof of anything."
                  : source === "forensics"
                    ? "Signature, compression, geometry, duration and level measurements taken from the real bytes."
                    : source === "gemini"
                      ? "A semantic pass over the media. It supplies observations only — it never sets the score."
                      : "Source-traceable corroboration. Requires search grounding to be configured."}
              </p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-14 px-6 md:px-10">
        <SectionLabel>Privacy</SectionLabel>
        <Panel className="p-6">
          <p className="max-w-3xl text-sm leading-relaxed text-dim">
            Your media is validated, hashed and measured{" "}
            <span className="text-foreground">in your browser</span>. It is never written to cloud
            storage. When the semantic pass runs, only the file (or a few sampled frames) is sent to
            the model for that single request, and the report you get back is kept for this browsing
            session only. Nothing here fabricates a result: any stage that cannot run says{" "}
            <span className="text-foreground">Unavailable — not configured</span> instead.
          </p>
        </Panel>
      </section>

      <SiteFooter />
    </div>
  );
}
