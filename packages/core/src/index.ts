/**
 * @health/core — the domain layer.
 *
 * Everything the product knows about health data lives here, with no React,
 * no network and no runtime dependencies. Both the browser bundle and the BFF
 * import this same package, which is what lets the dashboard and the assistant
 * be provably looking at the same numbers: there is one implementation of
 * "what is the 7-day average resting heart rate", not two.
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
} from "./types";

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
export type { ISODate } from "./dates";
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
} from "./dates";

export { boundedGaussian, chance, clamp, createRng, gaussian, pick, round } from "./rng";

// ─── Persona and data ───────────────────────────────────────────────────────
export {
  MAYA,
  PLAN_LENGTH_DAYS,
  PLAN_STARTED_DAYS_AGO,
  personaWithDatedGoals,
} from "./persona";
export {
  DEFAULT_DAYS,
  DEFAULT_SEED,
  createDefaultDataset,
  generateDataset,
} from "./dataset";
export type { GenerateOptions } from "./dataset";

// ─── Analytics ──────────────────────────────────────────────────────────────
export { METRIC_META, HEADLINE_METRICS, CHARTABLE_METRICS, metricMeta } from "./metricMeta";
export { buildSeries, computeMetrics } from "./metrics";
export type {
  DerivedMetrics,
  GoalProgress,
  MetricsBundle,
  SleepHeartRateLink,
} from "./metrics";
export {
  computeReadiness,
  readinessBand,
  readinessFor,
} from "./readiness";
export { focusInsights, rankInsights, runInsightRules } from "./insights";

// ─── Grounding ──────────────────────────────────────────────────────────────
export {
  buildRefIndex,
  formatEvidenceValue,
  hasRef,
  indexFromCatalogue,
  refCatalogue,
  resolveRef,
} from "./refs";
export type { RefIndex } from "./refs";
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

import { computeMetrics } from "./metrics";
import type { MetricsBundle } from "./metrics";
import { buildRefIndex } from "./refs";
import type { RefIndex } from "./refs";
import { computeReadiness } from "./readiness";
import { runInsightRules } from "./insights";
import type { HealthDataset, Insight, ReadinessScore } from "./types";

export interface DashboardModel {
  bundle: MetricsBundle;
  readiness: ReadinessScore;
  insights: Insight[];
  index: RefIndex;
}

/**
 * Compute the dashboard once, in dependency order, and hand back everything
 * downstream consumers need. The UI calls this in a Redux thunk; the BFF calls
 * it per chat request. Same function, same result.
 */
export function buildDashboard(dataset: HealthDataset): DashboardModel {
  const bundle = computeMetrics(dataset);
  const readiness = computeReadiness(bundle);
  // Readiness is passed in so its component scores are citable too — the
  // assistant should be able to explain the hero number, not just quote it.
  const index = buildRefIndex(bundle, readiness);
  const insights = runInsightRules(bundle, index);
  return { bundle, readiness, insights, index };
}
