/**
 * @health/core — the domain layer, with no React, no network and no runtime
 * dependencies. Both the browser bundle and the BFF import it, which is what
 * lets the dashboard and the assistant look at the same numbers by
 * construction rather than by discipline.
 */

// ─── Domain types ───────────────────────────────────────────────────────────
export type {
  ChartAnnotation,
  DailyRecord,
  DataQualityNote,
  DatasetEvent,
  EvidenceRef,
  Goal,
  HealthDataset,
  Insight,
  InsightSeverity,
  MetricKey,
  MetricMeta,
  MetricSummary,
  NutritionRecord,
  Persona,
  ReadinessBand,
  ReadinessComponent,
  ReadinessScore,
  SeriesPoint,
  SleepRecord,
  WindowedStat,
  Workout,
  WorkoutType,
} from "./models/types";

// ─── HTTP contract ──────────────────────────────────────────────────────────
export type {
  ChatEvent,
  ChatTurn,
  DashboardPayload,
  Effort,
  HealthResponse,
  PublicConfig,
} from "./api";

// ─── Utilities ──────────────────────────────────────────────────────────────
export type { ISODate } from "./utils/dates";
export {
  addDays,
  bedtimeToTimeline,
  clockToMinutes,
  dateRange,
  dayOfWeek,
  daysBetween,
  formatDuration,
  formatLongDate,
  formatShortDate,
  isWeekend,
  minutesToClock,
  parseISODate,
  toISODate,
  today,
} from "./utils/dates";

export { boundedGaussian, chance, clamp, createRng, gaussian, pick, round } from "./utils/rng";

// ─── Persona and data ───────────────────────────────────────────────────────
export {
  MAYA,
  PLAN_LENGTH_DAYS,
  PLAN_STARTED_DAYS_AGO,
  personaWithDatedGoals,
} from "./models/persona";
export {
  DEFAULT_DAYS,
  DEFAULT_SEED,
  createDefaultDataset,
  generateDataset,
} from "./analytics/dataset";
export type { GenerateOptions } from "./analytics/dataset";

// ─── Analytics ──────────────────────────────────────────────────────────────
export { METRIC_META, HEADLINE_METRICS, CHARTABLE_METRICS, metricMeta } from "./models/metricMeta";
export { buildSeries, computeMetrics } from "./analytics/metrics";
export type {
  DerivedMetrics,
  GoalProgress,
  MetricsBundle,
  SleepHeartRateLink,
} from "./analytics/metrics";
export {
  computeReadiness,
  readinessBand,
  readinessFor,
} from "./analytics/readiness";
export { focusInsights, rankInsights, runInsightRules } from "./analytics/insights";

// ─── Grounding ──────────────────────────────────────────────────────────────
export {
  buildRefIndex,
  formatEvidenceValue,
  hasRef,
  indexFromCatalogue,
  refCatalogue,
  resolveRef,
} from "./utils/refs";
export type { RefIndex } from "./utils/refs";
export {
  dropRepeatedUnits,
  renderGrounded,
  segmentGrounded,
  stripRefTokens,
  validateCitations,
} from "./llm/grounding";
export type { GroundedSegment, GroundingReport } from "./llm/grounding";

// ─── Assistant: prompt and queries ──────────────────────────────────────────
export {
  SUGGESTED_QUESTIONS,
  buildDataSnapshot,
  buildSystemPrompt,
  estimateTokens,
} from "./llm/context";
export type { SnapshotInput } from "./llm/context";
export {
  comparePeriods,
  getMetricSeries,
  getSleepBreakdown,
  getWorkouts,
  windowLabel,
} from "./llm/queries";
export type {
  ComparePeriodsResult,
  MetricSeriesResult,
  SleepBreakdownResult,
  WindowStats,
  WorkoutsResult,
} from "./llm/queries";

// ─── One-shot bundle ────────────────────────────────────────────────────────

import { computeMetrics } from "./analytics/metrics";
import type { MetricsBundle } from "./analytics/metrics";
import { buildRefIndex } from "./utils/refs";
import type { RefIndex } from "./utils/refs";
import { computeReadiness } from "./analytics/readiness";
import { runInsightRules } from "./analytics/insights";
import type { HealthDataset, Insight, ReadinessScore } from "./models/types";

export interface DashboardModel {
  bundle: MetricsBundle;
  readiness: ReadinessScore;
  insights: Insight[];
  index: RefIndex;
}

/**
 * Compute the dashboard once, in dependency order. The BFF calls this at boot
 * and again per chat request; both sides get the same result.
 */
export const buildDashboard = (dataset: HealthDataset): DashboardModel => {
  const bundle = computeMetrics(dataset);
  const readiness = computeReadiness(bundle);
  // Readiness is passed in so its component scores are citable too — the
  // assistant should be able to explain the hero number, not just quote it.
  const index = buildRefIndex(bundle, readiness);
  const insights = runInsightRules(bundle, index);
  return { bundle, readiness, insights, index };
};
