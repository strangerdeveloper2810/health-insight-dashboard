/**
 * The reference index — the single list of numbers this app is allowed to talk
 * about. Insight cards build their evidence from it and the BFF validates the
 * model's citations against it, so "the model must not invent numbers" is a
 * check that passes or fails rather than an instruction in a prompt.
 */

import { daysBetween, minutesToClock } from "./dates";
import { METRIC_META } from "./metricMeta";
import type { MetricsBundle } from "./metrics";
import type {
  EvidenceRef,
  MetricKey,
  ReadinessScore,
  WindowedStat,
} from "./types";

export interface RefIndex {
  refs: Map<string, EvidenceRef>;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export const formatEvidenceValue = (evidence: EvidenceRef): string => {
  const { value, unit, precision, format } = evidence;

  if (format === "duration") {
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const h = Math.floor(abs / 60);
    const m = Math.round(abs % 60);
    return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
  }

  if (format === "clock") {
    return minutesToClock(value);
  }

  const formatted =
    precision === 0
      ? Math.round(value).toLocaleString("en-US")
      : NUMBER_FORMAT.format(Number(value.toFixed(precision)));

  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
};

// ─── Index construction ─────────────────────────────────────────────────────

const windowKey = (window: WindowedStat["window"]): string => {
  return window; // "7d" | "30d" | "90d"
};

const pushRef = (
  refs: Map<string, EvidenceRef>,
  ref: string,
  label: string,
  value: number,
  unit: string,
  precision: number,
  format: EvidenceRef["format"] = "number",
): void => {
  refs.set(ref, { ref, label, value, unit, precision, format });
};

export const buildRefIndex = (
  bundle: MetricsBundle,
  readiness?: ReadinessScore,
): RefIndex => {
  const refs = new Map<string, EvidenceRef>();

  for (const key of Object.keys(METRIC_META) as MetricKey[]) {
    const meta = METRIC_META[key];
    const summary = bundle.summaries[key];
    if (!summary) continue;

    const format: EvidenceRef["format"] =
      meta.unit === "min" ? "duration" : meta.unit === "clock" ? "clock" : "number";

    for (const stat of summary.windows) {
      const suffix = windowKey(stat.window);
      pushRef(
        refs,
        `${key}.avg${suffix}`,
        `${meta.label} (${suffix} average)`,
        stat.average,
        meta.unit,
        meta.precision,
        format,
      );
      pushRef(
        refs,
        `${key}.change${suffix}`,
        `${meta.label} (change vs previous ${suffix})`,
        stat.changePct ?? 0,
        "%",
        1,
      );
    }

    const sevenDay = summary.windows.find((w) => w.window === "7d");
    if (sevenDay) {
      pushRef(
        refs,
        `${key}.latest`,
        `${meta.label} (latest)`,
        sevenDay.latest,
        meta.unit,
        meta.precision,
        format,
      );
      pushRef(
        refs,
        `${key}.min7d`,
        `${meta.label} (7-day low)`,
        sevenDay.min,
        meta.unit,
        meta.precision,
        format,
      );
      pushRef(
        refs,
        `${key}.max7d`,
        `${meta.label} (7-day high)`,
        sevenDay.max,
        meta.unit,
        meta.precision,
        format,
      );
    }
  }

  const { derived } = bundle;

  pushRef(
    refs,
    "derived.sleepDebt14dMin",
    "Sleep debt over the last 14 nights",
    derived.sleepDebt14dMin,
    "min",
    0,
    "duration",
  );
  pushRef(
    refs,
    "derived.nightsTracked14d",
    "Nights with sleep tracked (last 14)",
    derived.nightsTracked14d,
    "nights",
    0,
  );
  pushRef(
    refs,
    "derived.avgBedtimeMinutes",
    "Average bedtime (last 14 nights)",
    derived.avgBedtimeMinutes,
    "clock",
    0,
    "clock",
  );
  pushRef(
    refs,
    "derived.bedtimeStdDevMin",
    "Bedtime variability (last 14 nights)",
    derived.bedtimeStdDevMin,
    "min",
    0,
    "duration",
  );
  pushRef(
    refs,
    "derived.acwr",
    "Acute:chronic workload ratio",
    derived.acwr ?? 0,
    "ratio",
    2,
  );
  pushRef(
    refs,
    "derived.acuteLoadMin",
    "Training minutes in the last 7 days",
    derived.acuteLoadMin,
    "min",
    0,
    "duration",
  );
  pushRef(
    refs,
    "derived.chronicWeeklyLoadMin",
    "Average weekly training minutes (28-day)",
    derived.chronicWeeklyLoadMin,
    "min",
    0,
    "duration",
  );
  pushRef(
    refs,
    "derived.nutritionCompleteness",
    "Share of the last 30 days actually food-logged",
    Math.round(derived.nutritionLoggingCompleteness * 100),
    "%",
    0,
  );
  pushRef(
    refs,
    "derived.nutritionDaysLogged30d",
    "Days food-logged out of the last 30",
    derived.nutritionDaysLogged30d,
    "days",
    0,
  );
  pushRef(
    refs,
    "derived.stepGoalStreakDays",
    "Consecutive days at or above 8,000 steps",
    derived.stepGoalStreakDays,
    "days",
    0,
  );
  pushRef(
    refs,
    "derived.bestStepStreak30d",
    "Best 8,000-step streak in the last 30 days",
    derived.bestStepStreak30d,
    "days",
    0,
  );
  pushRef(
    refs,
    "derived.weekendStepGap",
    "Weekend minus weekday average steps",
    derived.weekendStepGap,
    "steps",
    0,
  );

  if (derived.sleepHeartRateLink) {
    const link = derived.sleepHeartRateLink;
    pushRef(
      refs,
      "derived.rhrAfterShortSleep",
      "Resting HR after a night under 6h30",
      link.avgRhrAfterShortSleep,
      "bpm",
      1,
    );
    pushRef(
      refs,
      "derived.rhrAfterNormalSleep",
      "Resting HR after a normal night",
      link.avgRhrAfterNormalSleep,
      "bpm",
      1,
    );
    pushRef(
      refs,
      "derived.shortSleepRhrDelta",
      "Resting HR penalty after a short night",
      link.deltaBpm,
      "bpm",
      1,
    );
    pushRef(
      refs,
      "derived.shortSleepNights",
      "Short nights in the last 30 days",
      link.shortSleepNights,
      "nights",
      0,
    );
  }

  for (const progress of derived.goalProgress) {
    const meta = METRIC_META[progress.goal.metric];
    const format: EvidenceRef["format"] =
      meta.unit === "min" ? "duration" : meta.unit === "clock" ? "clock" : "number";
    const base = `goal.${progress.goal.id}`;

    pushRef(
      refs,
      `${base}.current`,
      `${progress.goal.label} — current`,
      progress.currentValue,
      progress.goal.unit,
      meta.precision,
      format,
    );
    pushRef(
      refs,
      `${base}.target`,
      `${progress.goal.label} — target`,
      progress.targetValue,
      progress.goal.unit,
      meta.precision,
      format,
    );
    pushRef(
      refs,
      `${base}.percent`,
      `${progress.goal.label} — percent complete`,
      progress.percentComplete,
      "%",
      0,
    );
    pushRef(
      refs,
      `${base}.pacePerWeek`,
      `${progress.goal.label} — current pace per week`,
      progress.actualPacePerWeek,
      progress.goal.unit,
      meta.precision,
    );
    pushRef(
      refs,
      `${base}.requiredPacePerWeek`,
      `${progress.goal.label} — pace needed per week`,
      progress.requiredPacePerWeek,
      progress.goal.unit,
      meta.precision,
    );
    pushRef(
      refs,
      `${base}.daysRemaining`,
      `${progress.goal.label} — days remaining`,
      progress.daysRemaining,
      "days",
      0,
    );

    // Threshold goals are judged by consistency, not a projected date, so the
    // hit rate is the number the assistant actually needs.
    if (progress.daysMet !== null && progress.daysConsidered !== null) {
      pushRef(
        refs,
        `${base}.daysMet`,
        `${progress.goal.label} — days the target was met (last 30)`,
        progress.daysMet,
        "days",
        0,
      );
      pushRef(
        refs,
        `${base}.daysConsidered`,
        `${progress.goal.label} — days with data (last 30)`,
        progress.daysConsidered,
        "days",
        0,
      );
    }
  }

  // Where the user is inside their training plan — asked often enough in
  // conversation to deserve stable ids.
  const primary = derived.goalProgress.find(
    (p) => p.goal.id === bundle.dataset.persona.primaryGoal.id,
  );
  if (primary) {
    const elapsed = daysBetween(primary.goal.startDate, bundle.dataset.range.end);
    const total = daysBetween(primary.goal.startDate, primary.goal.targetDate);
    pushRef(refs, "plan.dayOfPlan", "Day of the current plan", elapsed, "days", 0);
    pushRef(refs, "plan.totalDays", "Total length of the plan", total, "days", 0);
    pushRef(
      refs,
      "plan.daysRemaining",
      "Days left in the plan",
      Math.max(0, total - elapsed),
      "days",
      0,
    );
  }

  if (readiness) {
    pushRef(refs, "readiness.score", "Readiness score (0–100)", readiness.score, "pts", 0);
    for (const component of readiness.components) {
      pushRef(
        refs,
        `readiness.${component.id}`,
        `Readiness — ${component.label} component`,
        component.score,
        "pts",
        0,
      );
    }
  }

  return { refs };
};

// ─── Resolution ─────────────────────────────────────────────────────────────

export const resolveRef = (index: RefIndex, ref: string): EvidenceRef | null => {
  return index.refs.get(ref) ?? null;
};

export const hasRef = (index: RefIndex, ref: string): boolean => {
  return index.refs.has(ref);
};

/**
 * The catalogue handed to the model: ref id, meaning, value. Sorted by id so
 * the serialised form is byte-stable across requests, which is what lets the
 * prompt cache hit.
 */
export const refCatalogue = (index: RefIndex): EvidenceRef[] => {
  return [...index.refs.values()].sort((a, b) => a.ref.localeCompare(b.ref));
};

/**
 * Rebuild an index from a catalogue that has been through JSON — a `Map` does
 * not survive serialisation, so the browser reconstructs the lookup from the
 * flat list. Last link in the grounding chain.
 */
export const indexFromCatalogue = (refs: EvidenceRef[]): RefIndex => {
  return { refs: new Map(refs.map((entry) => [entry.ref, entry])) };
};
