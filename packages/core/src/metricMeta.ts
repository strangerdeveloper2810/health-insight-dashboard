/**
 * The metric registry — every metric the app can chart, summarise, cite or
 * reason about, declared once: label, unit, precision, which direction is an
 * improvement, and what the number means. Read by the UI for formatting, the
 * insight rules for phrasing, and the LLM context so the model is told the
 * units rather than guessing them.
 */

import type { MetricKey, MetricMeta } from "./types";

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  steps: {
    key: "steps",
    label: "Steps",
    shortLabel: "Steps",
    unit: "steps",
    precision: 0,
    goodDirection: "up",
    domain: "activity",
    description: "Total steps recorded by the phone for the calendar day.",
  },
  activeMinutes: {
    key: "activeMinutes",
    label: "Active minutes",
    shortLabel: "Active",
    unit: "min",
    precision: 0,
    goodDirection: "up",
    domain: "activity",
    description:
      "Minutes at or above a brisk-walk intensity, as classified by the watch.",
  },
  caloriesBurned: {
    key: "caloriesBurned",
    label: "Calories burned",
    shortLabel: "Burned",
    unit: "kcal",
    precision: 0,
    goodDirection: "neutral",
    domain: "activity",
    description:
      "Total daily energy expenditure, including resting metabolism. Highly correlated with body size, so day-to-day swings are mostly noise.",
  },
  restingHeartRate: {
    key: "restingHeartRate",
    label: "Resting heart rate",
    shortLabel: "Resting HR",
    unit: "bpm",
    precision: 0,
    goodDirection: "down",
    domain: "cardio",
    description:
      "Lowest sustained heart rate during sleep. A falling trend over weeks indicates improving aerobic fitness; a spike usually means illness, alcohol or poor sleep.",
  },
  hrvMs: {
    key: "hrvMs",
    label: "Heart-rate variability",
    shortLabel: "HRV",
    unit: "ms",
    precision: 0,
    goodDirection: "up",
    domain: "cardio",
    description:
      "Beat-to-beat variation (RMSSD) measured overnight. Compared against your own baseline, not a population norm.",
  },
  sleepDurationMin: {
    key: "sleepDurationMin",
    label: "Sleep duration",
    shortLabel: "Sleep",
    unit: "min",
    precision: 0,
    goodDirection: "up",
    domain: "sleep",
    description: "Time actually asleep, excluding time lying awake in bed.",
  },
  sleepEfficiency: {
    key: "sleepEfficiency",
    label: "Sleep efficiency",
    shortLabel: "Efficiency",
    unit: "%",
    precision: 0,
    goodDirection: "up",
    domain: "sleep",
    description: "Time asleep as a share of time in bed.",
  },
  deepSleepMin: {
    key: "deepSleepMin",
    label: "Deep sleep",
    shortLabel: "Deep",
    unit: "min",
    precision: 0,
    goodDirection: "up",
    domain: "sleep",
    description:
      "Slow-wave sleep. Supports physical recovery; typically 13–23% of total sleep in adults.",
  },
  remSleepMin: {
    key: "remSleepMin",
    label: "REM sleep",
    shortLabel: "REM",
    unit: "min",
    precision: 0,
    goodDirection: "up",
    domain: "sleep",
    description:
      "Rapid-eye-movement sleep. Supports memory and emotional regulation; typically 20–25% of total sleep.",
  },
  bedtimeMinutes: {
    key: "bedtimeMinutes",
    label: "Bedtime",
    shortLabel: "Bedtime",
    unit: "clock",
    precision: 0,
    goodDirection: "neutral",
    domain: "sleep",
    description:
      "Clock time the user got into bed. Later than 00:00 is mapped past midnight so consistency can be measured correctly.",
  },
  weightKg: {
    key: "weightKg",
    label: "Weight",
    shortLabel: "Weight",
    unit: "kg",
    precision: 1,
    goodDirection: "neutral",
    domain: "body",
    description:
      "Measured on a smart scale. Day-to-day swings of 1–2 kg are water, not fat; only the multi-week trend is meaningful.",
  },
  systolic: {
    key: "systolic",
    label: "Systolic blood pressure",
    shortLabel: "Systolic",
    unit: "mmHg",
    precision: 0,
    goodDirection: "down",
    domain: "cardio",
    description: "Peak arterial pressure during a heartbeat.",
  },
  diastolic: {
    key: "diastolic",
    label: "Diastolic blood pressure",
    shortLabel: "Diastolic",
    unit: "mmHg",
    precision: 0,
    goodDirection: "down",
    domain: "cardio",
    description: "Arterial pressure between heartbeats.",
  },
  spo2: {
    key: "spo2",
    label: "Blood oxygen",
    shortLabel: "SpO₂",
    unit: "%",
    precision: 0,
    goodDirection: "up",
    domain: "cardio",
    description:
      "Oxygen saturation measured overnight. Dips can indicate breathing interruptions during sleep.",
  },
  caloriesConsumed: {
    key: "caloriesConsumed",
    label: "Calories consumed",
    shortLabel: "Intake",
    unit: "kcal",
    precision: 0,
    goodDirection: "neutral",
    domain: "nutrition",
    description:
      "Logged food energy. Under-counted on days the user did not finish logging — always read alongside logging completeness.",
  },
  proteinG: {
    key: "proteinG",
    label: "Protein",
    shortLabel: "Protein",
    unit: "g",
    precision: 0,
    goodDirection: "up",
    domain: "nutrition",
    description: "Logged protein intake.",
  },
  carbsG: {
    key: "carbsG",
    label: "Carbohydrates",
    shortLabel: "Carbs",
    unit: "g",
    precision: 0,
    goodDirection: "neutral",
    domain: "nutrition",
    description: "Logged carbohydrate intake.",
  },
  fatG: {
    key: "fatG",
    label: "Fat",
    shortLabel: "Fat",
    unit: "g",
    precision: 0,
    goodDirection: "neutral",
    domain: "nutrition",
    description: "Logged fat intake.",
  },
  sodiumMg: {
    key: "sodiumMg",
    label: "Sodium",
    shortLabel: "Sodium",
    unit: "mg",
    precision: 0,
    goodDirection: "down",
    domain: "nutrition",
    description:
      "Logged sodium intake. Relevant here because of the family history of hypertension and type-2 diabetes.",
  },
  waterMl: {
    key: "waterMl",
    label: "Water",
    shortLabel: "Water",
    unit: "ml",
    precision: 0,
    goodDirection: "up",
    domain: "nutrition",
    description: "Logged water intake.",
  },

  // ── Derived running metrics ───────────────────────────────────────────────
  // These are computed rather than recorded, but they behave like every other
  // metric so the goal system can track them uniformly.

  runDistanceKm: {
    key: "runDistanceKm",
    label: "Running distance",
    shortLabel: "Run",
    unit: "km",
    precision: 1,
    goodDirection: "up",
    domain: "activity",
    description: "Total distance run on the day. Zero on rest days.",
  },
  weeklyRunKm: {
    key: "weeklyRunKm",
    label: "Weekly running volume",
    shortLabel: "Weekly km",
    unit: "km",
    precision: 1,
    goodDirection: "up",
    domain: "activity",
    description:
      "Trailing seven-day running distance — the standard way to track training volume.",
  },
  longestRunKm: {
    key: "longestRunKm",
    label: "Longest recent run",
    shortLabel: "Longest run",
    unit: "km",
    precision: 1,
    goodDirection: "up",
    domain: "activity",
    description:
      "Longest single run in the last 28 days. The clearest signal of readiness for a 10K.",
  },
};

export const metricMeta = (key: MetricKey): MetricMeta => {
  return METRIC_META[key];
};

/** Metrics shown as the four headline tiles. */
export const HEADLINE_METRICS: MetricKey[] = [
  "steps",
  "sleepDurationMin",
  "restingHeartRate",
  "activeMinutes",
];

/** Metrics offered in the trends chart switcher, grouped for the picker. */
export const CHARTABLE_METRICS: MetricKey[] = [
  "steps",
  "activeMinutes",
  "restingHeartRate",
  "hrvMs",
  "sleepDurationMin",
  "sleepEfficiency",
  "deepSleepMin",
  "remSleepMin",
  "weightKg",
  "systolic",
  "spo2",
  "caloriesConsumed",
  "sodiumMg",
  "weeklyRunKm",
];
