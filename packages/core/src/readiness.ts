/**
 * Readiness score. The composite is never returned alone: each component
 * carries its own score, weight, raw inputs and an explanation of what moved
 * it, so the assistant can say which of the three parts is dragging.
 */

import { computeMetrics } from "./metrics";
import type { MetricsBundle } from "./metrics";
import { clamp, round } from "./rng";
import type {
  ReadinessBand,
  ReadinessComponent,
  ReadinessScore,
} from "./types";

type Bundle = MetricsBundle;

/** Linear map of `value` from [worst, best] onto 0–100, clamped at both ends. */
const scale = (value: number, worst: number, best: number): number => {
  if (best === worst) return 50;
  const t = (value - worst) / (best - worst);
  return round(clamp(t * 100, 0, 100), 0);
};

const verdict = (score: number): "up" | "down" | "flat" => {
  if (score >= 70) return "up";
  if (score >= 50) return "flat";
  return "down";
};

const SLEEP_TARGET_MIN = 420; // 7h — matches the user's stated sleep goal.
const SLEEP_FLOOR_MIN = 300; // 5h — below this, sleep scores zero.

/** Render a sleep-debt figure with the direction spelled out, not implied. */
const sleepDebtValue = (debtMin: number): string => {
  const abs = Math.abs(Math.round(debtMin));
  const h = Math.floor(abs / 60);
  const m = String(abs % 60).padStart(2, "0");
  const magnitude = `${h}h ${m}m`;
  if (abs < 15) return "balanced";
  return debtMin > 0 ? `${magnitude} behind` : `${magnitude} ahead`;
};

const sleepComponent = (bundle: Bundle): ReadinessComponent => {
  const summary = bundle.summaries.sleepDurationMin;
  const sevenDay = summary?.windows.find((w) => w.window === "7d");
  const durationAvg = sevenDay?.average ?? 0;

  const efficiency = bundle.summaries.sleepEfficiency?.windows.find(
    (w) => w.window === "7d",
  );
  const efficiencyAvg = efficiency?.average ?? 0;

  const { bedtimeStdDevMin, sleepDebt14dMin } = bundle.derived;

  const durationScore = scale(durationAvg, SLEEP_FLOOR_MIN, SLEEP_TARGET_MIN);
  const efficiencyScore = scale(efficiencyAvg, 70, 93);
  // A steady bedtime is worth more than a long but erratic one.
  const consistencyScore = scale(90 - bedtimeStdDevMin, 0, 90);

  const score = round(
    durationScore * 0.5 + efficiencyScore * 0.25 + consistencyScore * 0.25,
    0,
  );

  // Duration is named first unless it is close to target; only then do the
  // other factors get to lead.
  const explanation =
    durationScore < 75
      ? `Averaging ${Math.floor(durationAvg / 60)}h ${String(Math.round(durationAvg % 60)).padStart(2, "0")}m asleep against your 7-hour goal, which is ${Math.round(Math.abs(sleepDebt14dMin))} minutes short across the last two weeks.`
      : bedtimeStdDevMin > 45
        ? `Sleep length is on target, but bedtime varies by about ${bedtimeStdDevMin} minutes night to night, which fragments the rhythm.`
        : `Sleep length, efficiency and bedtime consistency are all in a healthy range.`;

  return {
    id: "sleep",
    label: "Sleep",
    score,
    weight: 0.4,
    explanation,
    inputs: [
      {
        label: "Average sleep (7d)",
        value: `${Math.floor(durationAvg / 60)}h ${String(Math.round(durationAvg % 60)).padStart(2, "0")}m`,
        contribution: verdict(durationScore),
      },
      {
        label: "Sleep efficiency",
        value: `${Math.round(efficiencyAvg)}%`,
        contribution: verdict(efficiencyScore),
      },
      {
        label: "Bedtime variability",
        value: `±${bedtimeStdDevMin} min`,
        contribution: verdict(consistencyScore),
      },
      {
        label: "Sleep debt (14d)",
        value: sleepDebtValue(sleepDebt14dMin),
        // Positive debt is a shortfall. The sign convention is the opposite of
        // intuition here, so the verdict is spelled out rather than inferred.
        contribution:
          sleepDebt14dMin > 120 ? "down" : sleepDebt14dMin < -120 ? "up" : "flat",
      },
    ],
  };
};

const recoveryComponent = (bundle: Bundle): ReadinessComponent => {
  const hrv7 = bundle.summaries.hrvMs?.windows.find((w) => w.window === "7d");
  const hrv30 = bundle.summaries.hrvMs?.windows.find((w) => w.window === "30d");
  const rhr7 = bundle.summaries.restingHeartRate?.windows.find((w) => w.window === "7d");
  const rhr30 = bundle.summaries.restingHeartRate?.windows.find(
    (w) => w.window === "30d",
  );

  const hrvRatio = hrv7 && hrv30 && hrv30.average > 0 ? hrv7.average / hrv30.average : 1;
  const rhrDelta = rhr7 && rhr30 ? rhr7.average - rhr30.average : 0;

  const hrvScore = scale(hrvRatio, 0.85, 1.15);
  // A falling resting heart rate is the good direction, hence the negation.
  const rhrScore = scale(-rhrDelta, -4, 4);

  const score = round(hrvScore * 0.6 + rhrScore * 0.4, 0);

  const explanation =
    rhrDelta > 2
      ? `Resting heart rate is running ${rhrDelta.toFixed(1)} bpm above your 30-day baseline — usually the first sign of accumulated fatigue, alcohol or an oncoming illness.`
      : hrvRatio < 0.95
        ? `HRV is ${Math.round((1 - hrvRatio) * 100)}% below your own baseline, so your nervous system has not fully recovered.`
        : `HRV and resting heart rate are both at or better than your own baseline.`;

  return {
    id: "recovery",
    label: "Recovery",
    score,
    weight: 0.3,
    explanation,
    inputs: [
      {
        label: "HRV vs baseline",
        value: `${Math.round(hrvRatio * 100)}%`,
        contribution: verdict(hrvScore),
      },
      {
        label: "Resting HR vs baseline",
        value: `${rhrDelta >= 0 ? "+" : ""}${rhrDelta.toFixed(1)} bpm`,
        contribution: verdict(rhrScore),
      },
    ],
  };
};

const loadComponent = (bundle: Bundle): ReadinessComponent => {
  const { acwr, acuteLoadMin, chronicWeeklyLoadMin } = bundle.derived;

  let score: number;
  let explanation: string;

  if (acwr === null) {
    score = 65;
    explanation =
      "No training load recorded in the last four weeks, so load cannot be assessed. Activity comes from steps alone.";
  } else if (acwr > 1.5) {
    score = scale(acwr, 2.2, 1.5);
    explanation = `Training load this week is ${acwr.toFixed(2)}× your four-week norm. Increases above roughly 1.5× are where running injuries cluster.`;
  } else if (acwr > 1.3) {
    score = scale(acwr, 1.5, 1.3);
    explanation = `Training load is ${acwr.toFixed(2)}× your four-week norm — a slightly aggressive ramp, worth watching but not alarming.`;
  } else if (acwr < 0.8) {
    score = scale(acwr, 0.2, 0.8);
    explanation = `Training load is ${acwr.toFixed(2)}× your four-week norm. Fitness gained so far will begin to fade if this continues.`;
  } else {
    score = 100;
    explanation = `Training load is ${acwr.toFixed(2)}× your four-week norm — inside the range where adaptation happens without excessive strain.`;
  }

  return {
    id: "load",
    label: "Load",
    score: round(score, 0),
    weight: 0.3,
    explanation,
    inputs: [
      {
        label: "Acute:chronic ratio",
        value: acwr === null ? "n/a" : `${acwr.toFixed(2)}×`,
        contribution: verdict(score),
      },
      {
        label: "Training (7d)",
        value: `${Math.round(acuteLoadMin)} min`,
        contribution: acuteLoadMin > 0 ? "flat" : "down",
      },
      {
        label: "Four-week norm",
        value: `${Math.round(chronicWeeklyLoadMin)} min/wk`,
        contribution: "flat",
      },
    ],
  };
};

export const readinessBand = (score: number): ReadinessBand => {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  return "poor";
};

const HEADLINES: Record<ReadinessComponent["id"], string> = {
  sleep: "Sleep is the thing holding you back",
  recovery: "Your body is still catching up",
  load: "Your training load is out of balance",
};

export const computeReadiness = (bundle: Bundle): ReadinessScore => {
  const components = [
    sleepComponent(bundle),
    recoveryComponent(bundle),
    loadComponent(bundle),
  ];

  const score = round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0),
    0,
  );
  const band = readinessBand(score);

  // The limiting factor is the component furthest below its own potential, not
  // simply the lowest raw score: Load spans a wider range than Recovery, so raw
  // scores would always blame Load.
  const limiting = [...components].sort((a, b) => a.score - b.score)[0];

  const headline =
    score >= 85
      ? "You're in good shape today"
      : limiting && limiting.score < 70
        ? HEADLINES[limiting.id]
        : "Broadly on track, with room to tighten up";

  return { score, band, headline, components };
};

/** Convenience for callers that already have a dataset. */
export const readinessFor = (dataset: Bundle["dataset"]): ReadinessScore => {
  return computeReadiness(computeMetrics(dataset));
};
