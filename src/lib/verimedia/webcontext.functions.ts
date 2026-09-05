import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface WebContextResult {
  status: "ok" | "unavailable";
  message: string;
  results: Array<{ title: string; url: string; snippet: string }>;
}

/**
 * Web context requires a configured Google Search grounding credential
 * (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX). No such credential is provisioned
 * here, so this stage reports itself unavailable rather than inventing sources.
 * Reverse image search is NOT implemented and is never claimed.
 */
export const fetchWebContext = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ query: z.string().max(400) }).parse(data))
  .handler(async ({ data }): Promise<WebContextResult> => {
    const key = process.env["GOOGLE_SEARCH_API_KEY"];
    const cx = process.env["GOOGLE_SEARCH_CX"];

    if (!key || !cx) {
      return {
        status: "unavailable",
        message:
          "Unavailable — not configured. Google Search grounding credentials are not present, so no web corroboration was attempted. Reverse image search is not implemented in this build.",
        results: [],
      };
    }

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", data.query);
    url.searchParams.set("num", "5");

    const res = await fetch(url);
    if (!res.ok) {
      return {
        status: "unavailable",
        message: `Web context lookup failed with HTTP ${res.status}. No results were recorded.`,
        results: [],
      };
    }

    const json = (await res.json()) as { items?: Array<{ title: string; link: string; snippet: string }> };
    return {
      status: "ok",
      message: "Search grounding returned source-traceable results.",
      results: (json.items ?? []).map((i) => ({ title: i.title, url: i.link, snippet: i.snippet })),
    };
  });
