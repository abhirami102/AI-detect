# VeriMedia AI Suite

# VeriMedia AI — Master Build Prompt

Build a production-quality web platform called **VeriMedia AI** that helps journalists, researchers, and everyday users detect, understand, and verify potentially AI-generated or manipulated **images, audio, and video** before trusting or sharing them.

## 1. Core User Flow

Build this complete flow:

**Landing → Upload/Link Media → Analysis Progress → Results → Evidence → Report**

Users must be able to:

* Upload image, audio, or video files
* Analyze a media URL where supported
* View analysis progress
* See a transparent risk assessment
* Understand the evidence behind the assessment
* Review metadata, forensic signals, AI analysis, and web context
* Generate/view a report

Do not create fake functionality. If a feature is unavailable or not configured, clearly show **“Unavailable — not configured”** or **“Prototype/Demo”** instead of pretending it worked.

---

# 2. Technology

Use:

* Next.js App Router
* TypeScript strict mode
* Tailwind CSS
* shadcn/ui
* Lucide icons
* Zod validation
* Google Gemini via `@google/genai`
* Google Cloud Storage with local fallback
* ffmpeg/ffprobe for audio/video processing
* exif-parser for image metadata
* Vitest for tests

Environment variables:

* `GEMINI_API_KEY`
* `GEMINI_MODEL`
* Google Cloud Storage configuration
* Maximum file size: **50 MB**
* Maximum video duration: **120 seconds**

---

# 3. Media Security & Validation

Before processing media:

* Validate magic bytes/signature
* Validate MIME type and extension
* Validate file size
* Validate image dimensions
* Validate video duration
* Protect URL analysis against SSRF
* Sanitize filenames
* Generate secure storage filenames
* Calculate SHA-256 hash
* Never trust client-provided MIME types
* Never expose secrets

Support:

**Images:** JPEG, PNG, WebP
**Audio:** WAV, MP3, M4A
**Video:** MP4, WebM

---

# 4. Analysis Pipeline

Create separate services for:

### Metadata

Extract:

* EXIF
* creation/modification information where available
* camera/software information
* GPS where available
* metadata presence/absence

Important: **missing metadata is NOT proof of AI generation.**

### Image Forensics

Analyze available signals such as:

* compression
* dimensions
* metadata
* image consistency
* suspicious editing indicators

### Audio Forensics

Analyze available signals such as:

* codec/container
* duration
* sample rate
* metadata
* suspicious processing indicators

### Video Forensics

Analyze:

* codec/container
* duration
* frame information
* metadata
* selected frames
* suspicious manipulation indicators

### Gemini

Use Gemini for semantic/contextual analysis.

Gemini must return structured JSON containing observations, interpretations, confidence, and limitations.

**Gemini must never directly determine the final risk score.**

Clearly separate:

* **Observation:** what was detected
* **Interpretation:** what it could mean

---

# 5. Evidence & Scoring

Create a unified evidence model containing:

* source
* category
* observation
* interpretation
* severity
* confidence
* limitations

Sources may include:

* Metadata
* Forensics
* Gemini
* Web Context

Calculate the final score deterministically:

```text
syntheticMediaRisk =
metadataRisk × 15%
+ forensicRisk × 30%
+ geminiRisk × 30%
+ webRisk × 25%
```

Verdict bands:

```text
0–25   Likely Authentic
26–50  Mostly Authentic
51–70  Uncertain
71–85  Suspicious
86–100 High Synthetic-Media Risk
```

Do not hard-code fake AI scores or fake forensic bounding boxes.

---

# 6. Web Context

Use Google Search grounding where configured.

Provide source-traceable context such as:

* relevant web results
* publication/source information
* contextual claims
* supporting links

Do **not** claim to perform reverse image search unless it is actually implemented.

Web context must contribute only through the defined evidence/scoring system.

---

# 7. UI / Pages

Create a polished, professional verification product.

### `/`

Landing page:

* VeriMedia AI branding
* clear explanation
* supported media types
* “Analyze Media” CTA
* trust/privacy messaging
* modern professional design

### `/analyze`

Analysis page:

* drag/drop upload
* file picker
* URL input
* media preview
* validation errors
* file information
* analysis progress
* clear processing stages

### `/report/[id]`

Results page containing:

* Overall Synthetic Media Risk: **0–100**
* Verdict
* Confidence
* Plain-language explanation
* Evidence cards
* Metadata section
* Forensics section
* Gemini section
* Web Context section
* File information
* SHA-256 hash
* Limitations
* Uncertainty notice
* Report/export capability

Make the risk visualization easy to understand.

---

# 8. Dashboard / Components

Create reusable components for:

* Upload
* Analysis progress
* Risk score
* Verdict
* Evidence
* Metadata
* Forensics
* Web context
* Report
* Dashboard/statistics where appropriate

Use accessible controls, responsive layouts, loading states, empty states, and meaningful error states.

---

# 9. Privacy & Security

Implement:

* secure file handling
* SSRF protection
* validation before processing
* secure storage
* rate limiting where appropriate
* security headers
* no API-key exposure
* privacy-conscious messaging
* clear limitations

Do not retain user media unnecessarily.

---

# 10. Testing

Add tests for:

* file validation
* magic-byte detection
* SSRF protection
* scoring
* evidence aggregation
* important API behavior

Run:

```bash
npm run lint
npm test
npm run build
```

Fix all errors.

---

# 11. Critical Honesty Rules

This is a media-verification product, so **never fabricate evidence**.

Never:

* invent AI detection results
* invent forensic results
* invent bounding boxes
* claim Gemini ran when it did not
* claim reverse image search when it did not
* treat missing EXIF as proof of manipulation
* present demo values as real forensic findings

If external services are not configured, the UI must clearly say:

**Unavailable — not configured**

If something is implemented only as a prototype:

**Prototype / Demo**

The application must still provide a useful experience using clearly labelled deterministic/demo behavior where necessary.

---

# 12. Final Goal

Prioritize a **complete working end-to-end product** over unfinished advanced infrastructure.

The minimum successful journey is:

**Upload/Link → Validate → Hash → Analyze → Aggregate Evidence → Calculate Risk → Explain Result → Report**

Build the actual application, not just documentation or placeholder folders.

Preserve existing useful validation, security, types, and tests if they already exist in the repository.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/00de469a-94c4-4a05-839c-f11e3e2c8a8a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
