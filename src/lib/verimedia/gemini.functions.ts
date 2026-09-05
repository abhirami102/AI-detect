import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  kind: z.enum(["image", "audio", "video"]),
  mime: z.string().max(64),
  /** base64 payloads without the data: prefix. Frames for video, one item otherwise. */
  payloads: z.array(z.string().max(9_000_000)).min(1).max(3),
  fileFacts: z.string().max(2000),
});

export interface GeminiObservation {
  category: string;
  observation: string;
  interpretation: string;
  severity: "none" | "info" | "low" | "moderate" | "high";
  confidence: number;
}

export interface GeminiResponse {
  status: "ok" | "unavailable" | "error";
  message: string;
  model?: string;
  observations: GeminiObservation[];
  overallConfidence: number;
  limitations: string[];
}

const SYSTEM = `You are the semantic-analysis stage of a media-verification pipeline used by journalists.
You inspect media for signs of synthetic generation or manipulation.

Hard rules:
- Report only what you can actually see or hear. Never invent detections, bounding boxes, or measurements.
- Separate OBSERVATION (what is present) from INTERPRETATION (what it could mean). Interpretations must stay hedged.
- Missing metadata, round resolutions, and clean audio are NOT proof of AI generation.
- You do not set the final risk score. You supply observations only.
- If the media is too low quality or too short to judge, say so and return low confidence.

Return ONLY minified JSON matching:
{"observations":[{"category":string,"observation":string,"interpretation":string,"severity":"none"|"info"|"low"|"moderate"|"high","confidence":number}],"overallConfidence":number,"limitations":[string]}
confidence values are 0..1. Return at most 6 observations.`;

const MODEL = "google/gemini-3.7-flash";

export const analyzeWithGemini = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GeminiResponse> => {
    const apiKey = process.env["LOVABLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
    const model = process.env["GEMINI_MODEL"] ?? MODEL;

    if (!apiKey) {
      return {
        status: "unavailable",
        message: "Unavailable — not configured. No AI credential is present in this environment.",
        observations: [],
        overallConfidence: 0,
        limitations: ["The semantic analysis stage did not run."],
      };
    }

    const parts: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Analyse this ${data.kind} for signs of synthetic generation or manipulation.\nFile facts from the pipeline (already measured, do not re-derive): ${data.fileFacts}\n${
          data.kind === "video"
            ? "You are given sampled frames from the clip, not the full video. Judge only these frames."
            : ""
        }`,
      },
    ];

    for (const payload of data.payloads) {
      if (data.kind === "audio") {
        const format = data.mime.includes("wav")
          ? "wav"
          : data.mime.includes("mp4")
            ? "m4a"
            : "mp3";
        parts.push({ type: "input_audio", input_audio: { data: payload, format } });
      } else {
        const mime = data.kind === "video" ? "image/jpeg" : data.mime;
        parts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${payload}` } });
      }
    }

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: parts },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (error) {
      return {
        status: "error",
        message: `The semantic analysis request could not be sent: ${(error as Error).message}`,
        observations: [],
        overallConfidence: 0,
        limitations: ["Network failure reaching the model."],
      };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message =
        res.status === 429
          ? "Rate limited by the AI service. Wait a moment and re-run this analysis."
          : res.status === 402
            ? "AI credits are exhausted for this workspace. The owner needs to top up before semantic analysis can run."
            : res.status === 403
              ? "AI access is blocked by workspace policy, so semantic analysis did not run."
              : `The model returned HTTP ${res.status}. ${body.slice(0, 200)}`;
      return {
        status: "error",
        message,
        model,
        observations: [],
        overallConfidence: 0,
        limitations: ["The semantic analysis stage did not produce results for this file."],
      };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";

    try {
      const cleaned = content
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned) as {
        observations?: GeminiObservation[];
        overallConfidence?: number;
        limitations?: string[];
      };
      return {
        status: "ok",
        message: "Semantic analysis completed.",
        model,
        observations: (parsed.observations ?? []).slice(0, 6),
        overallConfidence:
          typeof parsed.overallConfidence === "number" ? parsed.overallConfidence : 0.5,
        limitations: parsed.limitations ?? [],
      };
    } catch {
      return {
        status: "error",
        message: "The model replied in an unexpected format, so no observations were recorded.",
        model,
        observations: [],
        overallConfidence: 0,
        limitations: ["Structured output could not be parsed."],
      };
    }
  });
