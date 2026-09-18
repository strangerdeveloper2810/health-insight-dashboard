/**
 * Deterministic queries the assistant can run, for the questions the snapshot
 * cannot answer: "what did last Tuesday look like", "compare this month to
 * last", "show me the runs".
 *
 * Each is a pure read over the bundle the UI renders, and none calls a model —
 * the model decides which question to ask, the application what the answer is.
 */

import { addDays, bedtimeToTimeline, formatShortDate, minutesToClock } from "../utils/dates";
import type { ISODate } from "../utils/dates";
import { METRIC_META } from "../models/metricMeta";
import type { MetricsBundle } from "../analytics/metrics";
import type { MetricKey, SeriesPoint, Workout, WorkoutType } from "../models/types";

// ─── Shared helpers ─────────────────────────────────────────────────────────

const sliceWindow = (
  points: SeriesPoint[],
  endDate: ISODate,
  days: number,
): SeriesPoint[] => {
  const start = addDays(endDate, -(days - 1));
  return points.filter((point) => point.date >= start && point.date <= endDate);
};

export interface WindowStats {
  days: number;
  observed: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Percentage change against the immediately preceding window. */
  changePct: number | null;
}

const statsFor = (points: SeriesPoint[], days: number): WindowStats => {
  if (points.length === 0) {
    return { days, observed: 0, average: null, min: null, max: null, changePct: null };
  }
  const values = points.map((p) => p.value);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    days,
    observed: values.length,
    average: Number((sum / values.length).toFixed(2)),
    min: Math.min(...values),
    max: Math.max(...values),
    changePct: null,
  };
};

const withChange = (current: WindowStats, previous: WindowStats): WindowStats => {
  if (current.average === null || previous.average === null || previous.average === 0) {
    return current;
  }
  return {
    ...current,
    changePct: Number(
      (((current.average - previous.average) / previous.average) * 100).toFixed(1),
    ),
  };
};

const metricDescription = (metric: MetricKey) => {
  const meta = METRIC_META[metric];
  return {
    metric,
    label: meta.label,
    unit: meta.unit,
    /** Which way is an improvement — saves the model from guessing. */
    goodDirection: meta.goodDirection,
    description: meta.description,
  };
};

// ─── get_metric_series ──────────────────────────────────────────────────────

export interface MetricSeriesResult {
  metric: MetricKey;
  label: string;
  unit: string;
  goodDirection: string;
  from: ISODate;
  to: ISODate;
  observedDays: number;
  requestedDays: number;
  points: { date: ISODate; value: number }[];
  stats: WindowStats;
  /** Life events overlapping the window, so dips have an explanation. */
  annotations: { date: ISODate; label: string; kind: string }[];
  note?: string;
}

export const getMetricSeries = (
  bundle: MetricsBundle,
  metric: MetricKey,
  days = 30,
): MetricSeriesResult => {
  const window = Math.min(Math.max(days, 7), 90);
  const end = bundle.dataset.range.end;
  const points = sliceWindow(bundle.series[metric] ?? [], end, window);
  const start = addDays(end, -(window - 1));

  const annotations = bundle.dataset.events
    .filter((event) => {
      const eventEnd = event.endDate ?? event.date;
      return eventEnd >= start && event.date <= end;
    })
    .map((event) => ({ date: event.date, label: event.label, kind: event.kind }));

  const missing = window - points.length;

  // The trend only means something against the window immediately before it.
  const previous = statsFor(
    sliceWindow(bundle.series[metric] ?? [], addDays(start, -1), window),
    window,
  );

  return {
    ...metricDescription(metric),
    from: start,
    to: end,
    observedDays: points.length,
    requestedDays: window,
    points: points.map((p) => ({ date: p.date, value: p.value })),
    stats: withChange(statsFor(points, window), previous),
    annotations,
    // Days with no observation are absent rather than zero. Saying so
    // explicitly stops the model from reading a gap as a drop to nothing.
    note:
      missing > 0
        ? `${missing} of the ${window} days have no recorded value and are omitted — they are gaps in tracking, not zeroes.`
        : undefined,
  };
};

// ─── compare_periods ────────────────────────────────────────────────────────

export interface ComparePeriodsResult {
  metric: MetricKey;
  label: string;
  unit: string;
  goodDirection: string;
  windowDays: number;
  current: WindowStats & { from: ISODate; to: ISODate };
  previous: WindowStats & { from: ISODate; to: ISODate };
  changePct: number | null;
  changeAbs: number | null;
  /** "improved" | "worsened" | "flat", resolved against goodDirection. */
  verdict: "improved" | "worsened" | "flat" | "unknown";
}

export const comparePeriods = (
  bundle: MetricsBundle,
  metric: MetricKey,
  days = 7,
): ComparePeriodsResult => {
  const window = Math.min(Math.max(days, 7), 90);
  const end = bundle.dataset.range.end;
  const series = bundle.series[metric] ?? [];

  const currentEnd = end;
  const currentStart = addDays(end, -(window - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(window - 1));

  const current = statsFor(sliceWindow(series, currentEnd, window), window);
  const previous = statsFor(sliceWindow(series, previousEnd, window), window);
  const merged = withChange(current, previous);

  const changeAbs =
    current.average !== null && previous.average !== null
      ? Number((current.average - previous.average).toFixed(2))
      : null;

  const meta = METRIC_META[metric];
  let verdict: ComparePeriodsResult["verdict"] = "unknown";
  if (merged.changePct !== null && meta.goodDirection !== "neutral") {
    // A 1% move in either direction is noise, not a trend.
    if (Math.abs(merged.changePct) < 1) {
      verdict = "flat";
    } else {
      const rising = merged.changePct > 0;
      const good = meta.goodDirection === "up" ? rising : !rising;
      verdict = good ? "improved" : "worsened";
    }
  } else if (merged.changePct !== null) {
    verdict = "flat";
  }

  return {
    ...metricDescription(metric),
    windowDays: window,
    current: { ...merged, from: currentStart, to: currentEnd },
    previous: { ...previous, from: previousStart, to: previousEnd },
    changePct: merged.changePct,
    changeAbs,
    verdict,
  };
};

// ─── get_sleep_breakdown ────────────────────────────────────────────────────

export interface SleepBreakdownResult {
  from: ISODate;
  to: ISODate;
  nightsTracked: number;
  nightsRequested: number;
  averages: {
    totalMin: number | null;
    efficiencyPct: number | null;
    deepMin: number | null;
    remMin: number | null;
    awakeMin: number | null;
    bedtimeClock: string | null;
    wakeClock: string | null;
  };
  /** Night-to-night bedtime spread, in minutes. */
  bedtimeStdDevMin: number;
  debt14dMin: number;
  nights: {
    date: ISODate;
    totalMin: number;
    efficiencyPct: number;
    deepMin: number;
    remMin: number;
    awakeMin: number;
    bedtime: string;
    wakeTime: string;
  }[];
  note?: string;
}

export const getSleepBreakdown = (
  bundle: MetricsBundle,
  days = 14,
): SleepBreakdownResult => {
  const window = Math.min(Math.max(days, 7), 30);
  const end = bundle.dataset.range.end;
  const start = addDays(end, -(window - 1));

  const rows = bundle.dataset.daily
    .filter((day) => day.date >= start && day.date <= end && day.sleep !== null)
    .map((day) => ({
      date: day.date,
      totalMin: day.sleep!.totalMin,
      efficiencyPct: Math.round(day.sleep!.efficiency * 100),
      deepMin: day.sleep!.deepMin,
      remMin: day.sleep!.remMin,
      awakeMin: day.sleep!.awakeMin,
      bedtime: day.sleep!.bedtime,
      wakeTime: day.sleep!.wakeTime,
    }));

  const mean = (pick: (row: (typeof rows)[number]) => number): number | null =>
    rows.length === 0
      ? null
      : Number((rows.reduce((sum, row) => sum + pick(row), 0) / rows.length).toFixed(1));

  // Bedtimes straddle midnight, so they are averaged on a timeline where
  // 23:40 and 00:20 sit 40 minutes apart rather than 23 hours apart.
  const meanClock = (pick: (row: (typeof rows)[number]) => string): string | null =>
    rows.length === 0
      ? null
      : minutesToClock(
          rows.reduce((sum, row) => sum + bedtimeToTimeline(pick(row)), 0) / rows.length,
        );

  const missing = window - rows.length;

  return {
    from: start,
    to: end,
    nightsTracked: rows.length,
    nightsRequested: window,
    averages: {
      totalMin: mean((r) => r.totalMin),
      efficiencyPct: mean((r) => r.efficiencyPct),
      deepMin: mean((r) => r.deepMin),
      remMin: mean((r) => r.remMin),
      awakeMin: mean((r) => r.awakeMin),
      bedtimeClock: meanClock((r) => r.bedtime),
      wakeClock: meanClock((r) => r.wakeTime),
    },
    bedtimeStdDevMin: bundle.derived.bedtimeStdDevMin,
    debt14dMin: bundle.derived.sleepDebt14dMin,
    nights: rows,
    note:
      missing > 0
        ? `${missing} of the ${window} nights have no sleep record — the watch was not worn. Those nights are absent from every average here.`
        : undefined,
  };
};

// ─── get_workouts ───────────────────────────────────────────────────────────

export interface WorkoutsResult {
  from: ISODate;
  to: ISODate;
  count: number;
  totalMinutes: number;
  totalDistanceKm: number;
  byType: { type: WorkoutType; count: number; minutes: number; distanceKm: number }[];
  workouts: {
    date: ISODate;
    type: WorkoutType;
    durationMin: number;
    distanceKm: number | null;
    avgHeartRate: number;
    maxHeartRate: number;
    perceivedEffort: number;
    zoneMinutes: Workout["zoneMinutes"];
    note?: string;
  }[];
}

export const getWorkouts = (
  bundle: MetricsBundle,
  days = 14,
  type?: WorkoutType,
): WorkoutsResult => {
  const window = Math.min(Math.max(days, 7), 90);
  const end = bundle.dataset.range.end;
  const start = addDays(end, -(window - 1));

  const matching = bundle.dataset.workouts
    .filter((workout) => workout.date >= start && workout.date <= end)
    .filter((workout) => (type ? workout.type === type : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byType = new Map<
    WorkoutType,
    { type: WorkoutType; count: number; minutes: number; distanceKm: number }
  >();
  for (const workout of matching) {
    const entry = byType.get(workout.type) ?? {
      type: workout.type,
      count: 0,
      minutes: 0,
      distanceKm: 0,
    };
    entry.count += 1;
    entry.minutes += workout.durationMin;
    entry.distanceKm += workout.distanceKm ?? 0;
    byType.set(workout.type, entry);
  }

  return {
    from: start,
    to: end,
    count: matching.length,
    totalMinutes: matching.reduce((sum, w) => sum + w.durationMin, 0),
    totalDistanceKm: Number(
      matching.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0).toFixed(1),
    ),
    byType: [...byType.values()].sort((a, b) => b.minutes - a.minutes),
    workouts: matching.map((workout) => ({
      date: workout.date,
      type: workout.type,
      durationMin: workout.durationMin,
      distanceKm: workout.distanceKm,
      avgHeartRate: workout.avgHeartRate,
      maxHeartRate: workout.maxHeartRate,
      perceivedEffort: workout.perceivedEffort,
      zoneMinutes: workout.zoneMinutes,
      note: workout.note,
    })),
  };
};

// ─── Formatting helper shared with the tool layer ───────────────────────────

/** A one-line, human-readable label for a window, used in tool summaries. */
export const windowLabel = (from: ISODate, to: ISODate): string => {
  return `${formatShortDate(from)} – ${formatShortDate(to)}`;
};
