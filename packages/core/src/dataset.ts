/**
 * Synthetic dataset generator.
 *
 * The values are invented; the relationships between them are not — resting
 * heart rate responds to the previous night's sleep, illness raises it, a
 * training block lowers it over weeks. Those relationships are what the insight
 * rules later discover, and a generator emitting independent noise would make
 * every rule fire on coincidence.
 *
 * Seeded, so a given (seed, end date) pair always produces the same dataset.
 */

import {
  addDays,
  dateRange,
  dayOfWeek,
  isWeekend,
  minutesToClock,
  toISODate,
} from "./dates";
import type { ISODate } from "./dates";
import {
  MAYA,
  PLAN_LENGTH_DAYS,
  PLAN_STARTED_DAYS_AGO,
  personaWithDatedGoals,
} from "./persona";
import {
  boundedGaussian,
  chance,
  clamp,
  createRng,
  gaussian,
  round,
} from "./rng";
import type {
  DailyRecord,
  DataQualityNote,
  DatasetEvent,
  HealthDataset,
  NutritionRecord,
  Persona,
  SleepRecord,
  Workout,
  WorkoutType,
} from "./types";

export interface GenerateOptions {
  /** Any positive integer. Same seed + same end date ⇒ same dataset. */
  seed?: number;
  /** Number of calendar days to generate, ending on `endDate`. */
  days?: number;
  /** Last day of the window. Defaults to today. */
  endDate?: ISODate;
}

export const DEFAULT_SEED = 20260918;
export const DEFAULT_DAYS = 90;

// ─── Narrative beats ────────────────────────────────────────────────────────
// Fixed offsets from the end of the window, so the story lands in the same
// place regardless of when the app is run.
//
// Counted in *days ago*, which runs backwards relative to the calendar: `from`
// is always the larger number. Naming them start/end invited writing them in
// the wrong order, which inverts the span silently — an event with `date` after
// `endDate` draws as a zero-width band, so the shading never appears.
const TRAVEL = { from: 13, to: 10, label: "Conference in Tokyo" };
const ILLNESS = { from: 35, to: 32, label: "Head cold" };
const NEW_SHOES = 62;
const CRUNCH = { from: 73, to: 70, label: "Product launch week" };

interface DayContext {
  index: number;
  date: ISODate;
  weekend: boolean;
  /** 1-based day of the training plan, or `null` before it started. */
  planDay: number | null;
  planWeek: number | null;
  traveling: boolean;
  ill: boolean;
  crunch: boolean;
}

const buildContexts = (days: number, endDate: ISODate): DayContext[] => {
  const dates = dateRange(endDate, days);
  const planStartIndex = days - PLAN_STARTED_DAYS_AGO;

  return dates.map((date, index) => {
    const planDay = index >= planStartIndex ? index - planStartIndex + 1 : null;
    return {
      index,
      date,
      weekend: isWeekend(date),
      planDay,
      planWeek: planDay === null ? null : Math.floor((planDay - 1) / 7) + 1,
      traveling: index >= days - TRAVEL.from && index <= days - TRAVEL.to,
      ill: index >= days - ILLNESS.from && index <= days - ILLNESS.to,
      crunch: index >= days - CRUNCH.from && index <= days - CRUNCH.to,
    };
  });
};

// ─── Sleep ──────────────────────────────────────────────────────────────────

const generateSleep = (
  rng: () => number,
  ctx: DayContext,
): SleepRecord | null => {
  // The watch is not worn every night, and assuming complete sleep data is one
  // of the most common lies a health dashboard tells.
  if (chance(rng, 0.05)) return null;

  let targetMin = ctx.weekend ? 400 : 372;

  // The plan nudges sleep up slowly and not in a straight line.
  if (ctx.planDay !== null) {
    targetMin += Math.min(22, ctx.planDay * 0.45);
  }
  if (ctx.traveling) targetMin -= 48;
  if (ctx.ill) targetMin += 34;
  if (ctx.crunch) targetMin -= 38;

  const totalMin = Math.round(
    clamp(gaussian(rng, targetMin, 33), 248, 566),
  );

  let efficiency = 0.88;
  if (ctx.ill) efficiency -= 0.075;
  if (ctx.traveling) efficiency -= 0.055;
  if (ctx.crunch) efficiency -= 0.03;
  efficiency = round(clamp(gaussian(rng, efficiency, 0.033), 0.7, 0.97), 3);

  const timeInBed = Math.round(totalMin / efficiency);
  const awakeMin = Math.max(4, timeInBed - totalMin);

  // Late bedtimes suppress deep sleep, so deep share is tied to the clock
  // rather than drawn independently.
  const wakeTarget = ctx.ill ? 480 : ctx.weekend ? 460 : 390;
  const wakeMinutes = Math.round(clamp(gaussian(rng, wakeTarget, 26), 300, 620));
  const bedtimeMinutes = wakeMinutes - timeInBed;

  const lateBy = Math.max(0, bedtimeMinutes - 23 * 60 - 30);
  const deepShare = clamp(
    gaussian(rng, 0.163 - lateBy * 0.00035, 0.028),
    0.07,
    0.24,
  );
  const remShare = clamp(gaussian(rng, 0.208, 0.03), 0.1, 0.3);

  const deepMin = Math.round(totalMin * deepShare);
  const remMin = Math.round(totalMin * remShare);
  const lightMin = Math.max(0, totalMin - deepMin - remMin);

  return {
    bedtime: minutesToClock(bedtimeMinutes),
    wakeTime: minutesToClock(wakeMinutes),
    totalMin,
    efficiency,
    deepMin,
    remMin,
    lightMin,
    awakeMin,
  };
};

// ─── Workouts ───────────────────────────────────────────────────────────────

const ZONE_PROFILES: Record<WorkoutType, [number, number, number, number, number]> = {
  // Share of the session spent in zones 1–5.
  run: [0.1, 0.52, 0.26, 0.1, 0.02],
  walk: [0.45, 0.45, 0.1, 0, 0],
  strength: [0.2, 0.42, 0.28, 0.1, 0],
  cycle: [0.12, 0.45, 0.28, 0.13, 0.02],
  yoga: [0.7, 0.28, 0.02, 0, 0],
  swim: [0.15, 0.5, 0.25, 0.1, 0],
};

const BASE_HR: Record<WorkoutType, number> = {
  run: 143,
  walk: 98,
  strength: 119,
  cycle: 133,
  yoga: 88,
  swim: 136,
};

const KCAL_PER_MIN: Record<WorkoutType, number> = {
  run: 10.4,
  walk: 4.6,
  strength: 6.2,
  cycle: 9.1,
  yoga: 3.4,
  swim: 9.8,
};

const buildWorkout = (
  rng: () => number,
  ctx: DayContext,
  type: WorkoutType,
  durationMin: number,
  distanceKm: number | null,
): Workout => {
  const avgHeartRate = boundedGaussian(rng, BASE_HR[type], 6, 80, 175);
  const maxHeartRate = Math.round(
    clamp(avgHeartRate + gaussian(rng, 22, 6), avgHeartRate + 6, 192),
  );
  const profile = ZONE_PROFILES[type];
  const zoneMinutes = {
    z1: Math.round(durationMin * profile[0]),
    z2: Math.round(durationMin * profile[1]),
    z3: Math.round(durationMin * profile[2]),
    z4: Math.round(durationMin * profile[3]),
    z5: Math.round(durationMin * profile[4]),
  };

  return {
    id: `w-${ctx.index}-${type}`,
    date: ctx.date,
    type,
    durationMin,
    distanceKm,
    avgHeartRate,
    maxHeartRate,
    caloriesBurned: Math.round(
      durationMin * KCAL_PER_MIN[type] * (0.92 + rng() * 0.16),
    ),
    zoneMinutes,
    perceivedEffort: boundedGaussian(rng, type === "run" ? 5 : 4, 1.2, 1, 10),
    ...(type === "run" && distanceKm !== null && distanceKm > 7
      ? { note: "Long run — kept it conversational" }
      : {}),
  };
};

const generateWorkout = (
  rng: () => number,
  ctx: DayContext,
): Workout | null => {
  if (ctx.ill) return null;

  const dow = dayOfWeek(ctx.date);

  if (ctx.planDay === null) {
    // Before the plan: unstructured, roughly twice a week.
    if (ctx.traveling) return null;
    if (!chance(rng, 0.29)) return null;

    const roll = rng();
    const type: WorkoutType =
      roll < 0.34 ? "walk" : roll < 0.58 ? "strength" : roll < 0.84 ? "run" : "yoga";
    const durationMin = boundedGaussian(
      rng,
      type === "run" ? 31 : type === "walk" ? 46 : 39,
      7,
      20,
      70,
    );
    const distanceKm =
      type === "run"
        ? round(clamp(gaussian(rng, 4.1, 0.6), 2.6, 5.6), 2)
        : type === "walk"
          ? round(clamp(gaussian(rng, 3.0, 0.7), 1.4, 5.0), 2)
          : null;
    return buildWorkout(rng, ctx, type, durationMin, distanceKm);
  }

  // On the plan: a fixed weekly shape.
  if (ctx.traveling || ctx.crunch) return null;

  const planWeek = ctx.planWeek ?? 1;

  if (dow === 0) {
    // Sunday long run — the session the goal is built around.
    const base = 3.8 + 0.5 * (planWeek - 1);
    const distanceKm = round(clamp(gaussian(rng, base, 0.35), 2.8, 12), 2);
    const durationMin = Math.round(distanceKm * 6.9 + gaussian(rng, 4, 2));
    return buildWorkout(rng, ctx, "run", durationMin, distanceKm);
  }

  if (dow === 2 || dow === 4) {
    if (!chance(rng, 0.88)) return null;
    const type: WorkoutType = dow === 4 && chance(rng, 0.35) ? "strength" : "run";
    if (type === "strength") {
      return buildWorkout(rng, ctx, "strength", boundedGaussian(rng, 40, 6, 25, 60), null);
    }
    const distanceKm = round(clamp(gaussian(rng, 4.6, 0.7), 3.0, 7.0), 2);
    const durationMin = Math.round(distanceKm * 6.7 + gaussian(rng, 3, 2));
    return buildWorkout(rng, ctx, "run", durationMin, distanceKm);
  }

  if (dow === 6) {
    if (!chance(rng, 0.78)) return null;
    const roll = rng();
    const type: WorkoutType = roll < 0.5 ? "strength" : roll < 0.8 ? "yoga" : "walk";
    return buildWorkout(
      rng,
      ctx,
      type,
      boundedGaussian(rng, type === "yoga" ? 34 : 42, 6, 20, 65),
      null,
    );
  }

  return null;
};

// ─── Nutrition ──────────────────────────────────────────────────────────────

const generateNutrition = (
  rng: () => number,
  ctx: DayContext,
): NutritionRecord | null => {
  // Logged on roughly three days in five — the gap is the point.
  if (!chance(rng, 0.61)) return null;

  const completeness = round(clamp(gaussian(rng, 0.82, 0.13), 0.45, 1), 2);

  const trueCalories =
    1880 + (ctx.weekend ? 340 : 0) + (ctx.ill ? -240 : 0) + gaussian(rng, 0, 190);

  // Under-logging shows up as a lower recorded total, not a missing day.
  const scale = completeness;

  return {
    calories: Math.round(clamp(trueCalories * scale, 600, 3600)),
    proteinG: Math.round(clamp(gaussian(rng, 96, 18) * scale, 20, 220)),
    carbsG: Math.round(clamp(gaussian(rng, 208, 42) * scale, 40, 480)),
    fatG: Math.round(clamp(gaussian(rng, 68, 15) * scale, 15, 160)),
    sodiumMg: Math.round(clamp(gaussian(rng, 2580, 640) * scale, 400, 5200)),
    waterMl: Math.round(clamp(gaussian(rng, 1520, 380) * scale, 200, 3200)),
    completeness,
  };
};

// ─── Daily assembly ─────────────────────────────────────────────────────────

const generateDay = (
  rng: () => number,
  ctx: DayContext,
  previousSleep: SleepRecord | null,
): { record: DailyRecord; workout: Workout | null } => {
  const workout = generateWorkout(rng, ctx);
  const sleep = generateSleep(rng, ctx);
  const nutrition = generateNutrition(rng, ctx);

  // ── Resting heart rate ──
  // Reacts to the night that just ended, hence the `previousSleep` read.
  let restingHeartRate = 62;
  if (ctx.planDay !== null) restingHeartRate -= Math.min(2.6, ctx.planDay * 0.055);
  if (ctx.ill) restingHeartRate += 6.2;
  else if (ctx.traveling) restingHeartRate += 3.1;
  else if (ctx.crunch) restingHeartRate += 1.9;

  if (previousSleep) {
    // 400 minutes is a pivot, not a clinical threshold: below it the penalty
    // climbs steeply enough that 6h20 and 5h30 nights differ meaningfully.
    const shortfall = Math.max(0, 400 - previousSleep.totalMin);
    restingHeartRate += Math.min(7, shortfall * 0.09);
    if (previousSleep.efficiency < 0.85) restingHeartRate += 1.4;
  }
  restingHeartRate = boundedGaussian(rng, restingHeartRate, 1.9, 46, 88);

  // ── HRV ──
  let hrvMs = 48;
  if (ctx.planDay !== null) hrvMs += Math.min(3.2, ctx.planDay * 0.068);
  if (ctx.ill) hrvMs -= 11.5;
  else if (ctx.traveling) hrvMs -= 6.2;
  if (previousSleep) {
    hrvMs -= Math.max(0, (392 - previousSleep.totalMin) * 0.095);
  }
  hrvMs -= Math.max(0, restingHeartRate - 63) * 1.35;
  hrvMs = boundedGaussian(rng, hrvMs, 3.8, 16, 96);

  // ── Steps ──
  let stepBase = ctx.weekend ? 9600 : 6150;
  if (ctx.planDay !== null) stepBase += Math.min(520, ctx.planDay * 11);
  if (ctx.traveling) stepBase += ctx.weekend ? 1800 : 5400;
  if (ctx.ill) stepBase *= 0.44;
  if (ctx.crunch) stepBase *= 0.78;
  const steps = boundedGaussian(rng, stepBase, stepBase * 0.19, 700, 26000);

  // ── Active minutes ──
  const workoutMinutes = workout?.durationMin ?? 0;
  const activeMinutes = boundedGaussian(
    rng,
    steps / 165 + workoutMinutes * 0.72,
    9,
    0,
    220,
  );

  // ── Energy expenditure ──
  const caloriesBurned = Math.round(
    clamp(
      1408 + steps * 0.041 + (workout?.caloriesBurned ?? 0) * 0.62,
      1200,
      4200,
    ),
  );

  // ── Weight ──
  const weightTrend = 68.4 - ctx.index * 0.0125 - (ctx.ill ? 0.7 : 0);
  const weightKg = chance(rng, 0.56)
    ? round(clamp(gaussian(rng, weightTrend, 0.33), 60, 80), 1)
    : null;

  // ── Blood pressure ──
  const systolicTrend = ctx.traveling || ctx.ill ? 5.5 : 0;
  const bloodPressure = chance(rng, 0.29)
    ? {
        systolic: boundedGaussian(rng, 118 + systolicTrend, 5.5, 96, 152),
        diastolic: boundedGaussian(rng, 76 + systolicTrend * 0.6, 4.6, 60, 100),
      }
    : null;

  // ── Blood oxygen ──
  const spo2 = sleep ? boundedGaussian(rng, 96.9, 0.85, 93, 100) : null;

  return {
    workout,
    record: {
      date: ctx.date,
      steps,
      activeMinutes,
      caloriesBurned,
      restingHeartRate,
      hrvMs,
      sleep,
      nutrition,
      weightKg,
      bloodPressure,
      spo2,
    },
  };
};

// ─── Events and data-quality notes ──────────────────────────────────────────

const buildEvents = (contexts: DayContext[]): DatasetEvent[] => {
  const at = (offsetFromEnd: number) => contexts[contexts.length - 1 - offsetFromEnd];
  const events: DatasetEvent[] = [];

  /**
   * Turn a days-ago window into a dated span, oldest end first. One helper
   * rather than three inline pairs of `at(...)` calls: getting the order wrong
   * fails silently — an event whose `date` is later than its `endDate` draws as
   * a zero-width band rather than throwing. Returns `null` when the generated
   * window is too short to contain the beat.
   */
  const span = (window: { from: number; to: number }) => {
    const older = at(window.from);
    const newer = at(window.to);
    return older && newer ? { date: older.date, endDate: newer.date } : null;
  };

  const travel = span(TRAVEL);
  if (travel) {
    events.push({
      id: "ev-travel",
      ...travel,
      kind: "travel",
      label: TRAVEL.label,
      description:
        "Five days of conference travel. Sleep got shorter and later, step count went up, no training sessions.",
    });
  }

  const illness = span(ILLNESS);
  if (illness) {
    events.push({
      id: "ev-illness",
      ...illness,
      kind: "illness",
      label: ILLNESS.label,
      description:
        "Four days unwell. Resting heart rate up, HRV down, no training, appetite reduced.",
    });
  }

  const planStart = at(PLAN_STARTED_DAYS_AGO);
  if (planStart) {
    events.push({
      id: "ev-plan-start",
      date: planStart.date,
      kind: "plan-start",
      label: "Started 10K training plan",
      description:
        "Twelve-week plan: two easy runs midweek, one session on Saturday, a long run on Sunday.",
    });
  }

  const shoes = at(NEW_SHOES);
  if (shoes) {
    events.push({
      id: "ev-shoes",
      date: shoes.date,
      kind: "equipment",
      label: "New running shoes",
      description: "Replaced shoes that had done roughly 800 km.",
    });
  }

  const crunch = span(CRUNCH);
  if (crunch) {
    events.push({
      id: "ev-crunch",
      ...crunch,
      kind: "life",
      label: CRUNCH.label,
      description:
        "A heavy work week. Training was skipped and sleep shortened — reflected in the data rather than hidden.",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
};

const buildDataQuality = (
  daily: DailyRecord[],
  workouts: Workout[],
): DataQualityNote[] => {
  const total = daily.length || 1;
  const nutritionLogged = daily.filter((d) => d.nutrition !== null).length;
  const sleepTracked = daily.filter((d) => d.sleep !== null).length;
  const weightLogged = daily.filter((d) => d.weightKg !== null).length;

  const partialLogs = daily.filter(
    (d) => d.nutrition !== null && d.nutrition.completeness < 0.8,
  ).length;

  return [
    {
      scope: "nutrition",
      completeness: round(nutritionLogged / total, 2),
      note: `Food was logged on ${nutritionLogged} of ${total} days, and ${partialLogs} of those logs cover less than 80% of the day. Nutrition totals are undercounts, not measurements — treat any nutrition trend as indicative only.`,
    },
    {
      scope: "sleep",
      completeness: round(sleepTracked / total, 2),
      note: `Sleep was tracked on ${sleepTracked} of ${total} nights. The remaining nights had no watch worn.`,
    },
    {
      scope: "weightKg",
      completeness: round(weightLogged / total, 2),
      note: `Weight was recorded on ${weightLogged} of ${total} days. Day-to-day changes are mostly fluid; only the multi-week direction is meaningful.`,
    },
    {
      scope: "workouts",
      completeness: 1,
      note: `${workouts.length} workouts recorded. Sessions are logged automatically by the watch, so this domain is complete.`,
    },
  ];
};

// ─── Public API ─────────────────────────────────────────────────────────────

export const generateDataset = (
  persona: Persona = MAYA,
  options: GenerateOptions = {},
): HealthDataset => {
  const seed = options.seed ?? DEFAULT_SEED;
  const days = options.days ?? DEFAULT_DAYS;
  const endDate = options.endDate ?? toISODate(new Date());

  const rng = createRng(seed);
  const contexts = buildContexts(days, endDate);

  const daily: DailyRecord[] = [];
  const workouts: Workout[] = [];
  let previousSleep: SleepRecord | null = null;

  for (const ctx of contexts) {
    const { record, workout } = generateDay(rng, ctx, previousSleep);
    daily.push(record);
    if (workout) workouts.push(workout);
    previousSleep = record.sleep;
  }

  const start = contexts[0]?.date ?? endDate;
  const planStart = addDays(endDate, -PLAN_STARTED_DAYS_AGO);
  const planEnd = addDays(planStart, PLAN_LENGTH_DAYS - 1);

  return {
    persona: personaWithDatedGoals(persona, start, planStart, planEnd),
    generatedAt: new Date().toISOString(),
    seed,
    range: { start, end: endDate, days },
    daily,
    workouts,
    events: buildEvents(contexts),
    dataQuality: buildDataQuality(daily, workouts),
  };
};

/** Convenience wrapper using the bundled persona and default seed. */
export const createDefaultDataset = (options: GenerateOptions = {}): HealthDataset => {
  return generateDataset(MAYA, options);
};
