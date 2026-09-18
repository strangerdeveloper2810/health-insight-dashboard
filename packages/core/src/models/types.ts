/**
 * Domain model — the contract between the generator, the metrics layer, the
 * UI and the LLM context. Nothing here imports React, fetch or any other
 * runtime dependency.
 */

import type { ISODate } from "../utils/dates";

// ─── Persona ────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  label: string;
  /**
   * `"journey"` — a value travelling from a start to a target, where progress
   * is the fraction of the distance covered. `"threshold"` — a level met on a
   * given day or not, measured as days met out of thirty. Treating a threshold
   * as a journey produces numbers that are arithmetically correct and useless.
   */
  kind: "journey" | "threshold";
  /** Which metric the goal tracks, e.g. `"steps"`. */
  metric: MetricKey;
  unit: string;
  startValue: number;
  targetValue: number;
  /** Whether progress means the number going up or down. */
  direction: "increase" | "decrease";
  startDate: ISODate;
  targetDate: ISODate;
  /** Why this goal exists — shown in the UI and given to the assistant. */
  rationale: string;
}

export interface Persona {
  id: string;
  name: string;
  age: number;
  sex: "female" | "male" | "other";
  occupation: string;
  location: string;
  heightCm: number;
  /** Clinical and lifestyle context that changes how data should be read. */
  riskFactors: string[];
  conditions: string[];
  medications: string[];
  /** Stated in the user's own words — the assistant should speak to this. */
  subjectiveNotes: string[];
  primaryGoal: Goal;
  secondaryGoals: Goal[];
  clinicianGuidance: string;
}

// ─── Daily records ──────────────────────────────────────────────────────────

export interface SleepRecord {
  /** Local wall-clock time the user got into bed, `HH:MM`. */
  bedtime: string;
  wakeTime: string;
  /** Time actually asleep, in minutes. */
  totalMin: number;
  /** Time asleep ÷ time in bed, 0–1. */
  efficiency: number;
  deepMin: number;
  remMin: number;
  lightMin: number;
  awakeMin: number;
}

export interface NutritionRecord {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  waterMl: number;
  /** Share of the day actually logged, 0–1. Below ~0.8 the totals are
   *  undercounts, not measurements. */
  completeness: number;
}

export interface DailyRecord {
  date: ISODate;
  steps: number;
  activeMinutes: number;
  caloriesBurned: number;
  restingHeartRate: number;
  /** Heart-rate variability, RMSSD in milliseconds. */
  hrvMs: number;
  /** `null` when the watch was not worn — a real and common gap. */
  sleep: SleepRecord | null;
  /** `null` when nothing was logged that day. */
  nutrition: NutritionRecord | null;
  weightKg: number | null;
  bloodPressure: { systolic: number; diastolic: number } | null;
  spo2: number | null;
}

export type WorkoutType =
  | "run"
  | "walk"
  | "strength"
  | "cycle"
  | "yoga"
  | "swim";

export interface Workout {
  id: string;
  date: ISODate;
  type: WorkoutType;
  durationMin: number;
  distanceKm: number | null;
  avgHeartRate: number;
  maxHeartRate: number;
  caloriesBurned: number;
  /** Minutes spent in each of the five heart-rate zones. */
  zoneMinutes: { z1: number; z2: number; z3: number; z4: number; z5: number };
  /** Borg-style rating of perceived exertion, 1–10. */
  perceivedEffort: number;
  note?: string;
}

/** Something that happened in the user's life that explains a change in the data. */
export interface DatasetEvent {
  id: string;
  date: ISODate;
  endDate?: ISODate;
  kind: "illness" | "travel" | "plan-start" | "race" | "equipment" | "life";
  label: string;
  description: string;
}

export interface DataQualityNote {
  /** Metric or domain the note applies to. */
  scope: string;
  /** 0–1 where 1 is complete. */
  completeness: number;
  note: string;
}

export interface HealthDataset {
  persona: Persona;
  generatedAt: string;
  seed: number;
  range: { start: ISODate; end: ISODate; days: number };
  daily: DailyRecord[];
  workouts: Workout[];
  events: DatasetEvent[];
  dataQuality: DataQualityNote[];
}

// ─── Metric keys ────────────────────────────────────────────────────────────

export type MetricKey =
  | "steps"
  | "activeMinutes"
  | "caloriesBurned"
  | "restingHeartRate"
  | "hrvMs"
  | "sleepDurationMin"
  | "sleepEfficiency"
  | "deepSleepMin"
  | "remSleepMin"
  | "bedtimeMinutes"
  | "weightKg"
  | "systolic"
  | "diastolic"
  | "spo2"
  | "caloriesConsumed"
  | "proteinG"
  | "carbsG"
  | "fatG"
  | "sodiumMg"
  | "waterMl"
  // Derived running metrics — computed from workouts, not recorded daily.
  | "runDistanceKm"
  | "weeklyRunKm"
  | "longestRunKm";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  /** Decimal places to render with. */
  precision: number;
  /** Direction that counts as an improvement for this metric. */
  goodDirection: "up" | "down" | "neutral";
  domain: "activity" | "sleep" | "cardio" | "body" | "nutrition";
  description: string;
}

// ─── Derived metrics ────────────────────────────────────────────────────────

export interface SeriesPoint {
  date: ISODate;
  value: number;
}

/** A single statistic over a named window, with the window's bounds kept. */
export interface WindowedStat {
  window: "7d" | "30d" | "90d";
  days: number;
  average: number;
  min: number;
  max: number;
  /** Most recent value in the window. */
  latest: number;
  /** Days with a real observation — never assume it equals `days`. */
  sampleCount: number;
  /** Change from the previous equally-sized window, as a percentage. */
  changePct: number | null;
  /** Change from the previous equally-sized window, in the metric's unit. */
  changeAbs: number | null;
}

export interface MetricSummary {
  key: MetricKey;
  meta: MetricMeta;
  windows: WindowedStat[];
  series: SeriesPoint[];
}

// ─── Readiness ──────────────────────────────────────────────────────────────

export type ReadinessBand = "excellent" | "good" | "fair" | "poor";

export interface ReadinessComponent {
  id: "sleep" | "recovery" | "load";
  label: string;
  /** 0–100. */
  score: number;
  weight: number;
  /** Plain-language explanation of what moved this score. */
  explanation: string;
  /** The raw inputs behind the score, so the UI can show its work. */
  inputs: { label: string; value: string; contribution: "up" | "down" | "flat" }[];
}

export interface ReadinessScore {
  /** 0–100 composite. */
  score: number;
  band: ReadinessBand;
  headline: string;
  components: ReadinessComponent[];
}

// ─── Insights ───────────────────────────────────────────────────────────────

/**
 * A reference to a computed value — the only legal way for the UI or the LLM
 * to point at a number, which is what makes grounding checkable.
 */
export interface EvidenceRef {
  /** Stable dotted id, e.g. `"restingHeartRate.avg7d"`. */
  ref: string;
  label: string;
  value: number;
  unit: string;
  precision: number;
  /** How to render `value`: a plain number, a duration, or a clock time. */
  format?: "number" | "duration" | "clock";
}

export type InsightSeverity = "positive" | "watch" | "alert" | "info";

export interface Insight {
  id: string;
  /** Rule that produced it — surfaced in the UI's "Why?" panel. */
  rule: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  /** The suggested next action, phrased as something the user can do today. */
  action: string;
  evidence: EvidenceRef[];
  /** Set when this insight is affected by incomplete logging. */
  caveat?: string;
}

// ─── Annotations ────────────────────────────────────────────────────────────

export interface ChartAnnotation {
  date: ISODate;
  endDate?: ISODate;
  label: string;
  kind: DatasetEvent["kind"];
}
