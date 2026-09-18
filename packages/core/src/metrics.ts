/**
 * The analytics layer. Everything downstream — charts, tiles, insight cards and
 * the LLM's context — is built from the `MetricsBundle` this module produces,
 * so the model cannot cite a value the dashboard does not have.
 */

import {
  addDays,
  bedtimeToTimeline,
  daysBetween,
  isWeekend,
} from "./dates";
import type { ISODate } from "./dates";
import { METRIC_META, metricMeta } from "./metricMeta";
import { round } from "./rng";
import type {
  DailyRecord,
  Goal,
  HealthDataset,
  MetricKey,
  MetricSummary,
  SeriesPoint,
  WindowedStat,
  Workout,
} from "./types";

// ─── Series construction ────────────────────────────────────────────────────

/** Pull a raw daily value, or `null` when the day has no observation. */
const rawValue = (record: DailyRecord, key: MetricKey): number | null => {
  switch (key) {
    case "steps":
      return record.steps;
    case "activeMinutes":
      return record.activeMinutes;
    case "caloriesBurned":
      return record.caloriesBurned;
    case "restingHeartRate":
      return record.restingHeartRate;
    case "hrvMs":
      return record.hrvMs;
    case "sleepDurationMin":
      return record.sleep?.totalMin ?? null;
    case "sleepEfficiency":
      return record.sleep ? round(record.sleep.efficiency * 100, 0) : null;
    case "deepSleepMin":
      return record.sleep?.deepMin ?? null;
    case "remSleepMin":
      return record.sleep?.remMin ?? null;
    case "bedtimeMinutes":
      return record.sleep ? bedtimeToTimeline(record.sleep.bedtime) : null;
    case "weightKg":
      return record.weightKg;
    case "systolic":
      return record.bloodPressure?.systolic ?? null;
    case "diastolic":
      return record.bloodPressure?.diastolic ?? null;
    case "spo2":
      return record.spo2;
    case "caloriesConsumed":
      return record.nutrition?.calories ?? null;
    case "proteinG":
      return record.nutrition?.proteinG ?? null;
    case "carbsG":
      return record.nutrition?.carbsG ?? null;
    case "fatG":
      return record.nutrition?.fatG ?? null;
    case "sodiumMg":
      return record.nutrition?.sodiumMg ?? null;
    case "waterMl":
      return record.nutrition?.waterMl ?? null;
    // Derived running metrics are assembled from workouts below.
    case "runDistanceKm":
    case "weeklyRunKm":
    case "longestRunKm":
      return null;
  }
};

const runDistanceByDate = (workouts: Workout[]): Map<ISODate, number> => {
  const byDate = new Map<ISODate, number>();
  for (const workout of workouts) {
    if (workout.type !== "run" || workout.distanceKm === null) continue;
    byDate.set(workout.date, (byDate.get(workout.date) ?? 0) + workout.distanceKm);
  }
  return byDate;
};

/**
 * Build one metric's daily series. Days with no observation are omitted rather
 * than zero-filled — a zero step count and a day the phone was not carried are
 * different facts.
 */
export const buildSeries = (dataset: HealthDataset, key: MetricKey): SeriesPoint[] => {
  const points: SeriesPoint[] = [];

  if (key === "runDistanceKm") {
    const byDate = runDistanceByDate(dataset.workouts);
    for (const record of dataset.daily) {
      points.push({ date: record.date, value: round(byDate.get(record.date) ?? 0, 2) });
    }
    return points;
  }

  if (key === "weeklyRunKm") {
    const byDate = runDistanceByDate(dataset.workouts);
    const dates = dataset.daily.map((d) => d.date);
    const dailyRun = dates.map((d) => byDate.get(d) ?? 0);
    for (let i = 0; i < dates.length; i += 1) {
      let sum = 0;
      for (let j = Math.max(0, i - 6); j <= i; j += 1) sum += dailyRun[j] ?? 0;
      points.push({ date: dates[i] as ISODate, value: round(sum, 2) });
    }
    return points;
  }

  if (key === "longestRunKm") {
    const byDate = runDistanceByDate(dataset.workouts);
    const dates = dataset.daily.map((d) => d.date);
    const dailyRun = dates.map((d) => byDate.get(d) ?? 0);
    for (let i = 0; i < dates.length; i += 1) {
      let max = 0;
      for (let j = Math.max(0, i - 27); j <= i; j += 1) {
        max = Math.max(max, dailyRun[j] ?? 0);
      }
      points.push({ date: dates[i] as ISODate, value: round(max, 2) });
    }
    return points;
  }

  for (const record of dataset.daily) {
    const value = rawValue(record, key);
    if (value !== null && Number.isFinite(value)) {
      points.push({ date: record.date, value });
    }
  }
  return points;
};

// ─── Windowed statistics ────────────────────────────────────────────────────

const sliceWindow = (
  points: SeriesPoint[],
  endDate: ISODate,
  days: number,
): SeriesPoint[] => {
  const startDate = addDays(endDate, -(days - 1));
  return points.filter((p) => p.date >= startDate && p.date <= endDate);
};

const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const statFor = (
  allPoints: SeriesPoint[],
  endDate: ISODate,
  window: WindowedStat["window"],
  days: number,
  precision: number,
): WindowedStat => {
  const current = sliceWindow(allPoints, endDate, days);
  const previous = sliceWindow(allPoints, addDays(endDate, -days), days);

  const values = current.map((p) => p.value);
  const average = values.length ? round(mean(values), precision) : 0;
  const prevAverage = previous.length ? mean(previous.map((p) => p.value)) : null;

  const changeAbs =
    prevAverage === null || previous.length === 0
      ? null
      : round(average - round(prevAverage, precision), precision);
  const changePct =
    prevAverage === null || prevAverage === 0
      ? null
      : round(((average - prevAverage) / Math.abs(prevAverage)) * 100, 1);

  return {
    window,
    days,
    average,
    min: values.length ? round(Math.min(...values), precision) : 0,
    max: values.length ? round(Math.max(...values), precision) : 0,
    latest: current.length ? (current[current.length - 1]?.value ?? 0) : 0,
    sampleCount: values.length,
    changePct,
    changeAbs,
  };
};

const summarise = (
  dataset: HealthDataset,
  key: MetricKey,
  series: SeriesPoint[],
): MetricSummary => {
  const meta = metricMeta(key);
  const endDate = dataset.range.end;
  return {
    key,
    meta,
    windows: [
      statFor(series, endDate, "7d", 7, meta.precision),
      statFor(series, endDate, "30d", 30, meta.precision),
      statFor(series, endDate, "90d", dataset.range.days, meta.precision),
    ],
    series,
  };
};

// ─── Derived analytics ──────────────────────────────────────────────────────

/** The relationship between a short night and the following day's resting HR. */
export interface SleepHeartRateLink {
  shortSleepThresholdMin: number;
  shortSleepNights: number;
  normalNights: number;
  avgRhrAfterShortSleep: number;
  avgRhrAfterNormalSleep: number;
  /** Positive means resting HR is higher after a short night. */
  deltaBpm: number;
  windowDays: number;
}

export interface GoalProgress {
  goal: Goal;
  currentValue: number;
  targetValue: number;
  /**
   * Journey goals: percentage of the distance from start to target covered.
   * Threshold goals: percentage of the window's days the level was met.
   */
  percentComplete: number;
  actualPacePerWeek: number;
  requiredPacePerWeek: number;
  projectedDate: ISODate | null;
  daysRemaining: number;
  status: "achieved" | "ahead" | "on-track" | "behind";
  /** Threshold goals only: days the level was met, out of days with data. */
  daysMet: number | null;
  daysConsidered: number | null;
  summary: string;
}

export interface DerivedMetrics {
  sleepDebt14dMin: number;
  nightsTracked14d: number;
  avgBedtimeMinutes: number;
  bedtimeStdDevMin: number;
  sleepHeartRateLink: SleepHeartRateLink | null;
  /** Acute:chronic workload ratio — this week's load over the 4-week norm. */
  acwr: number | null;
  acuteLoadMin: number;
  chronicWeeklyLoadMin: number;
  nutritionLoggingCompleteness: number;
  nutritionDaysLogged30d: number;
  goalProgress: GoalProgress[];
  stepGoalStreakDays: number;
  bestStepStreak30d: number;
  weekendStepGap: number;
}

// The user's own sleep goal, not a population ideal.
const SLEEP_DEBT_TARGET_MIN = 420; // 7h.
const SHORT_SLEEP_THRESHOLD_MIN = 390; // 6h30.

const computeSleepDebt = (daily: DailyRecord[], endDate: ISODate): {
  debtMin: number;
  nights: number;
} => {
  const start = addDays(endDate, -13);
  let debt = 0;
  let nights = 0;
  for (const record of daily) {
    if (record.date < start || record.date > endDate) continue;
    if (!record.sleep) continue;
    nights += 1;
    // Cap a single night's contribution: one 3-hour night is a bad night, not
    // four hours of compounding debt.
    debt += Math.min(150, SLEEP_DEBT_TARGET_MIN - record.sleep.totalMin);
  }
  return { debtMin: Math.round(debt), nights };
};

const computeBedtimeStats = (
  daily: DailyRecord[],
  endDate: ISODate,
): { avg: number; stdDev: number } => {
  const start = addDays(endDate, -13);
  const bedtimes: number[] = [];
  for (const record of daily) {
    if (record.date < start || record.date > endDate) continue;
    if (record.sleep) bedtimes.push(bedtimeToTimeline(record.sleep.bedtime));
  }
  if (bedtimes.length < 3) return { avg: 0, stdDev: 0 };

  const avg = mean(bedtimes);
  const variance = mean(bedtimes.map((b) => (b - avg) ** 2));
  return { avg: Math.round(avg), stdDev: Math.round(Math.sqrt(variance)) };
};

/**
 * Resting heart rate on the day *after* a short night, against the day after a
 * normal one — a relationship nobody can see by scrolling a list of nights.
 */
const computeSleepHeartRateLink = (
  daily: DailyRecord[],
  endDate: ISODate,
  windowDays = 30,
): SleepHeartRateLink | null => {
  const start = addDays(endDate, -(windowDays - 1));
  const afterShort: number[] = [];
  const afterNormal: number[] = [];

  for (let i = 1; i < daily.length; i += 1) {
    const today = daily[i];
    const yesterday = daily[i - 1];
    if (!today || !yesterday) continue;
    if (today.date < start || today.date > endDate) continue;
    const sleep = yesterday.sleep;
    if (!sleep) continue;

    if (sleep.totalMin < SHORT_SLEEP_THRESHOLD_MIN) {
      afterShort.push(today.restingHeartRate);
    } else {
      afterNormal.push(today.restingHeartRate);
    }
  }

  if (afterShort.length < 4 || afterNormal.length < 4) return null;

  const avgShort = mean(afterShort);
  const avgNormal = mean(afterNormal);

  return {
    shortSleepThresholdMin: SHORT_SLEEP_THRESHOLD_MIN,
    shortSleepNights: afterShort.length,
    normalNights: afterNormal.length,
    avgRhrAfterShortSleep: round(avgShort, 1),
    avgRhrAfterNormalSleep: round(avgNormal, 1),
    deltaBpm: round(avgShort - avgNormal, 1),
    windowDays,
  };
};

/**
 * Acute:chronic workload ratio — the last 7 days of training minutes over the
 * 28-day weekly average. Above ~1.5 is the usual flag for "increased too fast".
 */
const computeAcwr = (
  workouts: Workout[],
  endDate: ISODate,
): { acwr: number | null; acute: number; chronicWeekly: number } => {
  const acuteStart = addDays(endDate, -6);
  const chronicStart = addDays(endDate, -27);

  let acute = 0;
  let chronic = 0;
  for (const workout of workouts) {
    if (workout.date >= acuteStart && workout.date <= endDate) {
      acute += workout.durationMin;
    }
    if (workout.date >= chronicStart && workout.date <= endDate) {
      chronic += workout.durationMin;
    }
  }

  const chronicWeekly = chronic / 4;
  return {
    acute,
    chronicWeekly: Math.round(chronicWeekly),
    acwr: chronicWeekly > 0 ? round(acute / chronicWeekly, 2) : null,
  };
};

const computeNutritionCompleteness = (
  daily: DailyRecord[],
  endDate: ISODate,
): { completeness: number; daysLogged: number } => {
  const start = addDays(endDate, -29);
  let logged = 0;
  let weighted = 0;
  let total = 0;

  for (const record of daily) {
    if (record.date < start || record.date > endDate) continue;
    total += 1;
    if (record.nutrition) {
      logged += 1;
      weighted += record.nutrition.completeness;
    }
  }

  return {
    daysLogged: logged,
    completeness: total > 0 ? round(weighted / total, 2) : 0,
  };
};

const computeStepStreaks = (
  daily: DailyRecord[],
  endDate: ISODate,
  goalSteps = 8000,
): { current: number; best30d: number } => {
  let current = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    const record = daily[i];
    if (!record || record.steps < goalSteps) break;
    current += 1;
  }

  const start = addDays(endDate, -29);
  let best = 0;
  let run = 0;
  for (const record of daily) {
    if (record.date < start || record.date > endDate) continue;
    if (record.steps >= goalSteps) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { current, best30d: best };
};

const computeWeekendStepGap = (daily: DailyRecord[], endDate: ISODate): number => {
  const start = addDays(endDate, -29);
  const weekday: number[] = [];
  const weekend: number[] = [];

  for (const record of daily) {
    if (record.date < start || record.date > endDate) continue;
    (isWeekend(record.date) ? weekend : weekday).push(record.steps);
  }

  if (weekday.length === 0 || weekend.length === 0) return 0;
  return Math.round(mean(weekend) - mean(weekday));
};

// ─── Goals ──────────────────────────────────────────────────────────────────

/** Least-squares slope of value against day index. */
const regressionSlope = (points: SeriesPoint[]): number => {
  if (points.length < 3) return 0;
  const base = points[0]?.date ?? "";
  const xs = points.map((p) => daysBetween(base, p.date));
  const ys = points.map((p) => p.value);
  const n = points.length;
  const meanX = mean(xs);
  const meanY = mean(ys);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - meanX;
    numerator += dx * ((ys[i] ?? 0) - meanY);
    denominator += dx * dx;
  }
  return denominator === 0 ? 0 : numerator / denominator;
};

/**
 * How far back a threshold goal's consistency is measured — rolling, so it
 * responds when the habit changes rather than being anchored to the day the
 * goal was created.
 */
const THRESHOLD_WINDOW_DAYS = 30;

const evaluateThresholdGoal = (
  goal: Goal,
  series: SeriesPoint[],
  endDate: ISODate,
  currentValue: number,
  daysRemaining: number,
): GoalProgress => {
  const windowStart = addDays(endDate, -(THRESHOLD_WINDOW_DAYS - 1));
  const recent = series.filter((p) => p.date >= windowStart && p.date <= endDate);

  const met = (value: number) =>
    goal.direction === "increase"
      ? value >= goal.targetValue
      : value <= goal.targetValue;

  const daysMet = recent.filter((p) => met(p.value)).length;
  const daysConsidered = recent.length;
  const percentComplete =
    daysConsidered === 0 ? 0 : round((daysMet / daysConsidered) * 100, 0);

  const last7 = recent.slice(-7);
  const metLast7 = last7.filter((p) => met(p.value)).length;
  // "Achieved" for a habit means it is holding right now, not that it was
  // once hit — so it requires a full recent week, not a good month.
  const achieved = last7.length >= 5 && metLast7 === last7.length;

  let status: GoalProgress["status"];
  if (achieved) status = "achieved";
  else if (percentComplete >= 85) status = "ahead";
  else if (percentComplete >= 70) status = "on-track";
  else status = "behind";

  return {
    goal,
    currentValue,
    targetValue: goal.targetValue,
    percentComplete,
    // For a daily threshold the meaningful pace is days met per week, and the
    // only pace that holds the level is all seven of them.
    actualPacePerWeek: round((daysMet / Math.max(1, daysConsidered)) * 7, 1),
    requiredPacePerWeek: 7,
    projectedDate: null,
    daysRemaining,
    status,
    daysMet,
    daysConsidered,
    summary: "",
  };
};

const evaluateGoal = (
  goal: Goal,
  series: SeriesPoint[],
  endDate: ISODate,
): GoalProgress => {
  const inWindow = series.filter(
    (p) => p.date >= goal.startDate && p.date <= endDate,
  );
  const values = inWindow.map((p) => p.value);
  const precision = metricMeta(goal.metric).precision;

  const currentValue = values.length
    ? round(mean(values.slice(-7)), precision)
    : goal.startValue;

  const daysRemaining = Math.max(0, daysBetween(endDate, goal.targetDate));

  if (goal.kind === "threshold") {
    return evaluateThresholdGoal(goal, series, endDate, currentValue, daysRemaining);
  }

  const span = goal.targetValue - goal.startValue;
  const done = currentValue - goal.startValue;
  const percentComplete =
    span === 0 ? 100 : round(Math.max(0, Math.min(100, (done / span) * 100)), 0);

  const slopePerDay = regressionSlope(inWindow);
  const actualPacePerWeek = round(slopePerDay * 7, 2);

  const requiredTotal = goal.targetValue - currentValue;
  const weeksRemaining = daysRemaining / 7;
  const requiredPacePerWeek =
    weeksRemaining > 0 ? round(requiredTotal / weeksRemaining, 2) : 0;

  const achieved =
    goal.direction === "increase"
      ? currentValue >= goal.targetValue
      : currentValue <= goal.targetValue;

  let projectedDate: ISODate | null = null;
  if (!achieved && slopePerDay !== 0) {
    const movingTowardTarget =
      goal.direction === "increase" ? slopePerDay > 0 : slopePerDay < 0;
    if (movingTowardTarget) {
      const daysNeeded = Math.abs(requiredTotal / slopePerDay);
      // Beyond ~5 years the projection is noise, not a forecast.
      if (daysNeeded < 1825) projectedDate = addDays(endDate, Math.round(daysNeeded));
    }
  }

  let status: GoalProgress["status"];
  if (achieved) status = "achieved";
  else if (projectedDate !== null && projectedDate <= goal.targetDate) status = "ahead";
  else if (projectedDate !== null) status = "behind";
  else status = "behind";

  // "On track" is a softer verdict than "ahead": the pace needed is within
  // reach of the pace actually being run.
  if (status === "behind" && requiredPacePerWeek !== 0) {
    if (Math.abs(actualPacePerWeek) >= Math.abs(requiredPacePerWeek) * 0.9) {
      status = "on-track";
    }
  }

  return {
    goal,
    currentValue,
    targetValue: goal.targetValue,
    percentComplete,
    actualPacePerWeek,
    requiredPacePerWeek,
    projectedDate,
    daysRemaining,
    status,
    daysMet: null,
    daysConsidered: null,
    summary: "",
  };
};

// ─── Bundle ─────────────────────────────────────────────────────────────────

export interface MetricsBundle {
  dataset: HealthDataset;
  series: Record<MetricKey, SeriesPoint[]>;
  summaries: Record<MetricKey, MetricSummary>;
  derived: DerivedMetrics;
}

export const computeMetrics = (dataset: HealthDataset): MetricsBundle => {
  const keys = Object.keys(METRIC_META) as MetricKey[];

  const series = {} as Record<MetricKey, SeriesPoint[]>;
  const summaries = {} as Record<MetricKey, MetricSummary>;
  for (const key of keys) {
    const points = buildSeries(dataset, key);
    series[key] = points;
    summaries[key] = summarise(dataset, key, points);
  }

  const endDate = dataset.range.end;
  const sleepDebt = computeSleepDebt(dataset.daily, endDate);
  const bedtimes = computeBedtimeStats(dataset.daily, endDate);
  const acwr = computeAcwr(dataset.workouts, endDate);
  const nutrition = computeNutritionCompleteness(dataset.daily, endDate);
  const streaks = computeStepStreaks(dataset.daily, endDate);

  const goals = [dataset.persona.primaryGoal, ...dataset.persona.secondaryGoals];
  const goalProgress = goals.map((goal) =>
    evaluateGoal(goal, series[goal.metric] ?? [], endDate),
  );

  const derived: DerivedMetrics = {
    sleepDebt14dMin: sleepDebt.debtMin,
    nightsTracked14d: sleepDebt.nights,
    avgBedtimeMinutes: bedtimes.avg,
    bedtimeStdDevMin: bedtimes.stdDev,
    sleepHeartRateLink: computeSleepHeartRateLink(dataset.daily, endDate),
    acwr: acwr.acwr,
    acuteLoadMin: acwr.acute,
    chronicWeeklyLoadMin: acwr.chronicWeekly,
    nutritionLoggingCompleteness: nutrition.completeness,
    nutritionDaysLogged30d: nutrition.daysLogged,
    goalProgress,
    stepGoalStreakDays: streaks.current,
    bestStepStreak30d: streaks.best30d,
    weekendStepGap: computeWeekendStepGap(dataset.daily, endDate),
  };

  return { dataset, series, summaries, derived };
};
