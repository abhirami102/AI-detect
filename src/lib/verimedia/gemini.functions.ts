import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, type Part } from "@google/genai";
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

const MODEL = "gemini-3.7-flash";

export const analyzeWithGemini = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GeminiResponse> => {
    const apiKey = process.env["GEMINI_API_KEY"];

    if (!apiKey) {
      return {
        status: "unavailable",
        message:
          "Unavailable — not configured. No Gemini API credential is present in this environment.",
        observations: [],
        overallConfidence: 0,
        limitations: ["The semantic analysis stage did not run."],
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const textPrompt = `Analyse this ${data.kind} for signs of synthetic generation or manipulation.
File facts from the pipeline (already measured, do not re-derive): ${data.fileFacts}
${
  data.kind === "video"
    ? "You are given sampled frames from the clip, not the full video. Judge only these frames."
    : ""
}`;

    const parts: Part[] = [{ text: textPrompt }];

    for (const payload of data.payloads) {
      if (data.kind === "audio") {
        parts.push({
          inlineData: {
            mimeType: data.mime,
            data: payload,
          },
        });
      } else {
        parts.push({
          inlineData: {
            mimeType: data.kind === "video" ? "image/jpeg" : data.mime,
            data: payload,
          },
        });
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
        },
      });

      const content = response.text ?? "";

      if (!content.trim()) {
        return {
          status: "error",
          message: "Gemini returned an empty response.",
          model: MODEL,
          observations: [],
          overallConfidence: 0,
          limitations: ["The model returned no semantic analysis."],
        };
      }

      try {
        const parsed = JSON.parse(content) as {
          observations?: GeminiObservation[];
          overallConfidence?: number;
          limitations?: string[];
        };

        return {
          status: "ok",
          message: "Semantic analysis completed.",
          model: MODEL,
          observations: (parsed.observations ?? []).slice(0, 6),
          overallConfidence:
            typeof parsed.overallConfidence === "number"
              ? Math.max(0, Math.min(1, parsed.overallConfidence))
              : 0.5,
          limitations: parsed.limitations ?? [],
        };
      } catch {
        return {
          status: "error",
          message:
            "Gemini replied in an unexpected format, so no observations were recorded.",
          model: MODEL,
          observations: [],
          overallConfidence: 0,
          limitations: ["Structured output could not be parsed."],
        };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Gemini API error.";

      return {
        status: "error",
        message: `Gemini semantic analysis failed: ${message}`,
        model: MODEL,
        observations: [],
        overallConfidence: 0,
        limitations: ["The Gemini API request failed."],
      };
    }
  });
