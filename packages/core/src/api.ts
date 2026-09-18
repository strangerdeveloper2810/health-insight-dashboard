/**
 * The HTTP contract between the BFF and the browser, declared in the package
 * both sides already depend on so a payload shape cannot be written twice and
 * drift. Types only — no runtime code, so it costs the browser bundle nothing.
 */

import type { DerivedMetrics } from "./metrics";
import type {
  EvidenceRef,
  HealthDataset,
  Insight,
  MetricKey,
  MetricSummary,
  ReadinessScore,
  SeriesPoint,
} from "./types";

// ─── Configuration ──────────────────────────────────────────────────────────

/** Reasoning effort levels accepted by the model. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * The slice of server configuration that is safe to publish — listed field by
 * field on the server so a new secret cannot leak by being forgotten.
 */
export interface PublicConfig {
  model: string;
  effort: Effort;
  datasetSeed: number;
  datasetDays: number;
  /** False means the assistant will report itself unavailable. */
  assistantConfigured: boolean;
}

// ─── REST ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  ok: boolean;
  /** Presence of a key, never its value. */
  assistantConfigured: boolean;
  model: string;
  effort: Effort;
  refs: number;
  insights: number;
}

export interface DashboardPayload {
  dataset: HealthDataset;
  readiness: ReadinessScore;
  insights: Insight[];
  series: Record<MetricKey, SeriesPoint[]>;
  /** Per-metric summary windows, with the per-summary series omitted — it is
   *  byte-identical to `series` above and would double the payload. */
  summaries: Record<MetricKey, Omit<MetricSummary, "series">>;
  derived: DerivedMetrics;
  /** Every citable value, so the browser can resolve citation tokens. */
  refs: EvidenceRef[];
  config: PublicConfig;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Events the browser receives on the chat stream, discriminated on `type`.
 * Errors arrive as an event rather than an HTTP status: by the time the model
 * is called the response headers are already on the wire.
 */
export type ChatEvent =
  | { type: "tool"; name: string; status: "running" | "done" }
  | { type: "delta"; text: string }
  | {
      type: "done";
      grounding: { grounded: boolean; cited: string[]; unknown: string[] };
      usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
      stopReason: string | null;
    }
  | { type: "error"; code: string; message: string };
