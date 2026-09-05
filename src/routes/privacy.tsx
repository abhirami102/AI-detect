import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionLabel, SiteFooter, SiteHeader } from "@/components/verimedia/Chrome";
import { MAX_FILE_BYTES, MAX_VIDEO_SECONDS } from "@/lib/verimedia/constants";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & security — VeriMedia AI" },
      {
        name: "description",
        content:
          "What happens to your media: in-browser analysis, session-only reports, no cloud storage, SSRF-protected URL fetching, and strict upload validation.",
      },
      { property: "og:title", content: "Privacy & security — VeriMedia AI" },
      {
        property: "og:description",
        content: "In-browser analysis, session-only reports, no cloud storage.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Where your media goes",
    body: [
      "Validation, hashing, metadata parsing and forensic measurement all run in your browser. The bytes are not uploaded to VeriMedia AI storage, and no cloud bucket is configured in this deployment.",
      "When the semantic pass is available, the file — or, for video, a small number of sampled frames — is sent to the model provider for that single request only. Payloads above 6 MB are not sent; the stage reports itself as unavailable instead of silently truncating.",
    ],
  },
  {
    title: "What is retained",
    body: [
      "Reports are held in this browsing session only. Closing the tab or clearing the session removes them. Media files themselves are never retained, not even for the session.",
      "You can delete everything at any time from the Reports page.",
    ],
  },
  {
    title: "Upload safety",
    body: [
      `Files are capped at ${MAX_FILE_BYTES / 1024 / 1024} MB and video at ${MAX_VIDEO_SECONDS} seconds. The declared MIME type from your browser is never trusted: the file head is read and matched against known magic-byte signatures, and the detected type must agree with the extension.`,
      "Filenames are sanitised, and images with implausible pixel counts are rejected before decoding to avoid decompression bombs.",
    ],
  },
  {
    title: "URL fetching",
    body: [
      "Any URL you paste is checked before a request is made: only http and https are allowed, embedded credentials are rejected, non-standard ports are refused, and hostnames resolving to loopback, private, link-local, carrier-grade NAT, unique-local, or cloud-metadata ranges are blocked.",
      "The fetch is performed by your browser, not by our server, so this tool cannot be used to reach anything inside a private network.",
    ],
  },
  {
    title: "Honesty commitments",
    body: [
      "No evidence, bounding box, forensic finding, reverse-image-search match or model result is ever fabricated. A stage that cannot run says 'Unavailable — not configured'.",
      "Absence of metadata is reported as absence, never as proof of AI generation. Every evidence card separates what was observed from what it might mean, and states its own limitation.",
      "This is a Prototype / Demo. Its output is an aid to human judgement, not a legal or editorial determination.",
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="px-6 md:px-10">
        <SectionLabel>Privacy &amp; Security</SectionLabel>
        <h1 className="headline text-[clamp(2rem,6vw,4.5rem)]">
          Your media <span className="text-brand">stays put.</span>
        </h1>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {SECTIONS.map((s) => (
            <Panel key={s.title} className="p-6">
              <p className="label-mono">{s.title}</p>
              {s.body.map((p) => (
                <p key={p} className="mt-3 text-sm leading-relaxed text-dim">
                  {p}
                </p>
              ))}
            </Panel>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
