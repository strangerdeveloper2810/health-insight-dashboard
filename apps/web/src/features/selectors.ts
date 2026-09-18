/**
 * Memoised reads over the store. `createSelector` here is not ceremony:
 * `selectRefIndex` builds a Map from 258 entries and `selectTrendPoints`
 * slices a 90-point array, and both would rebuild on every keystroke in the
 * assistant's composer if they were plain functions reading state.
 */

import { createSelector } from "@reduxjs/toolkit";
import { indexFromCatalogue } from "@health/core";
import type {
  ChartAnnotation,
  DailyRecord,
  DatasetEvent,
  HealthDataset,
  InsightSeverity,
  ISODate,
  MetricKey,
  ReadinessScore,
  SeriesPoint,
} from "@health/core";

import type { RootState } from "@/app/store";

// ─── Base reads ─────────────────────────────────────────────────────────────

export const selectDashboard = (state: RootState) => state.dashboard;
export const selectPayload = (state: RootState) => state.dashboard.payload;
export const selectStatus = (state: RootState) => state.dashboard.status;
export const selectError = (state: RootState) => state.dashboard.error;
export const selectUi = (state: RootState) => state.ui;
export const selectAssistant = (state: RootState) => state.assistant;

/** Stable identities, so a selector returning "nothing" does not re-render. */
const NO_POINTS: SeriesPoint[] = [];
const NO_INSIGHTS: never[] = [];
const NO_REFS = [] as const;

export const selectDataset = createSelector(
  [selectPayload],
  (payload): HealthDataset | null => payload?.dataset ?? null,
);

export const selectReadiness = createSelector(
  [selectPayload],
  (payload): ReadinessScore | null => payload?.readiness ?? null,
);

export const selectInsights = createSelector(
  [selectPayload],
  (payload) => payload?.insights ?? NO_INSIGHTS,
);

/**
 * Insight severity, most urgent first. Declared here because two components
 * rank by it: if the hero and the feed ordered differently, the same insight
 * would appear twice on one screen — once as today's focus, once below it.
 */
const SEVERITY_ORDER: readonly InsightSeverity[] = ["alert", "watch", "positive", "info"];

export const selectSortedInsights = createSelector([selectInsights], (insights) =>
  [...insights].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  ),
);

/** The single thing the page leads with. */
export const selectTopInsight = createSelector(
  [selectSortedInsights],
  (insights) => insights[0] ?? null,
);

/** Everything the hero has not already shown. */
export const selectRestInsights = createSelector([selectSortedInsights], (insights) =>
  insights.slice(1),
);

export const selectDerived = createSelector(
  [selectPayload],
  (payload) => payload?.derived ?? null,
);

/**
 * The reference index, rebuilt only when the catalogue changes. This is the
 * client half of the grounding guarantee: citation tokens resolve against
 * exactly the values the charts read from.
 */
export const selectRefIndex = createSelector([selectPayload], (payload) =>
  payload ? indexFromCatalogue(payload.refs ?? [...NO_REFS]) : null,
);

export const selectAssistantConfigured = createSelector(
  [selectPayload],
  (payload) => payload?.config.assistantConfigured ?? false,
);

// ─── Per-metric reads ───────────────────────────────────────────────────────

export const selectSeries = (key: MetricKey) => {
  return (state: RootState): SeriesPoint[] =>
    state.dashboard.payload?.series[key] ?? NO_POINTS;
};

export const selectSummary = (key: MetricKey) => {
  return (state: RootState) => state.dashboard.payload?.summaries[key] ?? null;
};

export const selectPersona = createSelector(
  [selectDataset],
  (dataset) => dataset?.persona ?? null,
);

export const selectToday = createSelector([selectDataset], (dataset): DailyRecord | null => {
  if (!dataset || dataset.daily.length === 0) return null;
  return dataset.daily[dataset.daily.length - 1] ?? null;
});

// ─── Trend window ───────────────────────────────────────────────────────────

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

export const selectTrendPoints = createSelector(
  [selectPayload, selectUi],
  (payload, ui): SeriesPoint[] => {
    if (!payload) return NO_POINTS;
    const all = payload.series[ui.trendMetric];
    if (!all || all.length === 0) return NO_POINTS;
    return all.slice(-RANGE_DAYS[ui.trendRange]);
  },
);

const overlaps = (event: DatasetEvent, from: ISODate, to: ISODate): boolean => {
  // A one-day event ends the day it starts; a span uses its own end date.
  const end = event.endDate ?? event.date;
  return event.date <= to && end >= from;
};

/**
 * Life events that fall inside the visible window, so a chart of a bad week
 * has a visible cause sitting underneath it.
 */
export const selectAnnotations = createSelector(
  [selectDataset, selectTrendPoints, selectUi],
  (dataset, points, ui): ChartAnnotation[] => {
    if (!dataset || !ui.showEvents || points.length < 2) return [];
    const from = points[0]!.date;
    const to = points[points.length - 1]!.date;

    return dataset.events
      .filter((event) => overlaps(event, from, to))
      .map((event) => ({
        date: event.date < from ? from : event.date,
        endDate: event.endDate && event.endDate > to ? to : event.endDate,
        label: event.label,
        kind: event.kind,
      }));
  },
);

/** The window's summary row, for the header above the chart. */
export const selectTrendSummary = createSelector(
  [selectPayload, selectUi],
  (payload, ui) => {
    const windows = payload?.summaries[ui.trendMetric]?.windows ?? [];
    return windows.find((w) => w.window === ui.trendRange) ?? null;
  },
);
