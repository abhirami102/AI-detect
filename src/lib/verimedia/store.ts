import type { AnalysisReport } from "./types";

/**
 * Reports live in memory for the browsing session only. Media bytes are never
 * uploaded to storage and never persisted — only the derived report is kept,
 * and it is dropped when the tab closes.
 */
const memory = new Map<string, AnalysisReport>();

const KEY = "verimedia.reports.v1";

function loadSession(): Record<string, AnalysisReport> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, AnalysisReport>;
  } catch {
    return {};
  }
}

export function saveReport(report: AnalysisReport): void {
  memory.set(report.id, report);
  if (typeof sessionStorage === "undefined") return;
  try {
    const all = loadSession();
    all[report.id] = report;
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota exceeded — the in-memory copy still serves this session */
  }
}

export function getReport(id: string): AnalysisReport | undefined {
  return memory.get(id) ?? loadSession()[id];
}

export function listReports(): AnalysisReport[] {
  const all = { ...loadSession() };
  for (const [id, r] of memory) all[id] = r;
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

export function clearReports(): void {
  memory.clear();
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(KEY);
}

export function newReportId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
