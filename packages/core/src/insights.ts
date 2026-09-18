/**
 * The insight rule engine.
 *
 * These rules are the product's opinion. A health dashboard that shows
 * fourteen charts and no conclusions has outsourced the hard part — deciding
 * what matters — to the user. Each rule below encodes a judgement about what
 * is worth interrupting someone for, and each carries the evidence that
 * produced it so the claim can be checked rather than trusted.
 *
 * Every rule is a pure function of the computed metrics. The same `Insight`
 * objects render as cards on the dashboard and are serialised into the
 * assistant's context, so the two can never disagree about what is going on.
 */

import { daysBetween, formatShortDate } from "./dates";
import { formatEvidenceValue } from "./refs";
import type { RefIndex } from "./refs";
import type { EvidenceRef, Goal, Insight, InsightSeverity } from "./types";
import type { GoalProgress, MetricsBundle } from "./metrics";

/** Pull evidence refs, silently dropping any that the index cannot resolve. */
function evidence(index: RefIndex, refs: string[]): EvidenceRef[] {
  return refs
    .map((ref) => index.refs.get(ref))
    .filter((ref): ref is EvidenceRef => ref !== undefined);
}

function fmt(index: RefIndex, ref: string): string {
  const found = index.refs.get(ref);
  return found ? formatEvidenceValue(found) : "—";
}

// ─── Rules ──────────────────────────────────────────────────────────────────

function sleepHeartRateRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const link = bundle.derived.sleepHeartRateLink;
  if (!link) return null;
  if (link.deltaBpm < 2.5 || link.shortSleepNights < 5) return null;

  const shortNights = link.shortSleepNights;
  const totalNights = shortNights + link.normalNights;
  const pct = Math.round((shortNights / totalNights) * 100);

  return {
    id: "insight-sleep-rhr",
    rule: "sleep-heart-rate-link",
    severity: link.deltaBpm >= 4 ? "alert" : "watch",
    title: `Short nights cost you ${link.deltaBpm.toFixed(1)} bpm`,
    body: `On mornings after a night under 6h30, your resting heart rate averages ${fmt(index, "derived.rhrAfterShortSleep")}, against ${fmt(index, "derived.rhrAfterNormalSleep")} after a normal night. That is a ${link.deltaBpm.toFixed(1)} bpm penalty, and it applied to ${shortNights} of the last ${totalNights} nights (${pct}%).`,
    action:
      "Pick two weeknights this week and set a hard 23:00 lights-out. Two protected nights is enough to see whether the gap closes.",
    evidence: evidence(index, [
      "derived.rhrAfterShortSleep",
      "derived.rhrAfterNormalSleep",
      "derived.shortSleepRhrDelta",
      "derived.shortSleepNights",
    ]),
  };
}

function sleepDebtRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const debt = bundle.derived.sleepDebt14dMin;
  if (debt < 180) return null;

  const hours = Math.floor(debt / 60);
  const nights = bundle.derived.nightsTracked14d;

  return {
    id: "insight-sleep-debt",
    rule: "sleep-debt",
    severity: debt >= 420 ? "alert" : "watch",
    title: `${hours}h of accumulated sleep debt`,
    body: `Across the last ${nights} tracked nights you have slept roughly ${hours} hours less than your 7-hour goal in total. Sleep debt compounds: reaction time and insulin sensitivity both degrade before you consciously feel tired.`,
    action:
      "Rather than one long catch-up lie-in, add 30 minutes to your usual wake time on a weekend — it repays the debt without shifting your body clock.",
    evidence: evidence(index, [
      "derived.sleepDebt14dMin",
      "derived.nightsTracked14d",
      "sleepDurationMin.avg7d",
    ]),
  };
}

function bedtimeConsistencyRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const stdDev = bundle.derived.bedtimeStdDevMin;
  if (stdDev < 45) return null;

  return {
    id: "insight-bedtime-consistency",
    rule: "bedtime-consistency",
    severity: stdDev >= 70 ? "watch" : "info",
    title: `Bedtime swings by ${stdDev} minutes`,
    body: `Your average bedtime is ${fmt(index, "derived.avgBedtimeMinutes")}, but the night-to-night spread is ±${stdDev} minutes. A consistent wake time anchors the body clock more effectively than a consistent bedtime, and your sleep efficiency reflects the irregularity.`,
    action:
      "Keep your wake time within a 30-minute window for the next two weeks, including weekends, and let bedtime follow from it.",
    evidence: evidence(index, [
      "derived.bedtimeStdDevMin",
      "derived.avgBedtimeMinutes",
      "sleepEfficiency.avg7d",
    ]),
  };
}

/**
 * The suggested action has to follow from the goal. Telling someone to "add
 * one session" to fix their sleep is worse than saying nothing — it reads as
 * a machine that has not understood the question.
 */
const ACTION_BY_METRIC: Partial<Record<Goal["metric"], string>> = {
  sleepDurationMin:
    "Move lights-out 20 minutes earlier on weeknights. That alone is enough to shift the average without rearranging your evening.",
  restingHeartRate:
    "This one is downstream of the others — it responds to consistent easy volume and enough sleep, not to chasing it directly.",
  steps:
    "A 15-minute walk after lunch on weekdays covers most of the shortfall, and it lands on the days that are actually dragging.",
  longestRunKm:
    "Add one easy run per week rather than lengthening the ones you already do — your long run is already near its limit.",
};

function goalAction(progress: GoalProgress, onTrack: boolean): string {
  if (onTrack) {
    return "Hold the current pattern. At this point the value is in not changing anything.";
  }
  return (
    ACTION_BY_METRIC[progress.goal.metric] ??
    `You need ${progress.requiredPacePerWeek} ${progress.goal.unit} per week from here, against a current pace of ${progress.actualPacePerWeek}.`
  );
}

function goalProjectionRule(
  bundle: MetricsBundle,
  index: RefIndex,
  goalId: string,
): Insight | null {
  const progress = bundle.derived.goalProgress.find((p) => p.goal.id === goalId);
  if (!progress) return null;

  const isPrimary = progress.goal.id === bundle.dataset.persona.primaryGoal.id;

  // Secondary goals only earn space in the feed when they need attention.
  if (!isPrimary && progress.status !== "behind") return null;

  const base = `goal.${progress.goal.id}`;
  const { goal } = progress;
  const pretty = (n: number) =>
    goal.unit === "steps" ? n.toLocaleString("en-US") : `${n} ${goal.unit}`;

  if (goal.kind === "threshold") {
    const daysMet = progress.daysMet ?? 0;
    const daysConsidered = progress.daysConsidered ?? 0;
    const onTrack = progress.status !== "behind";

    return {
      id: `insight-${goal.id}-consistency`,
      rule: "goal-projection",
      severity: onTrack ? "positive" : "watch",
      title: onTrack
        ? `${goal.label} — holding`
        : `${goal.label} — ${daysMet} of the last ${daysConsidered} days`,
      body: `You have met this on ${daysMet} of the last ${daysConsidered} days with data (${progress.percentComplete}%). Your seven-day average is ${pretty(progress.currentValue)} against a target of ${pretty(progress.targetValue)}. This is a daily habit rather than a journey, so consistency is the measure — how close the average sits matters less than how often it clears the line.`,
      action: goalAction(progress, onTrack),
      evidence: evidence(index, [
        `${base}.daysMet`,
        `${base}.daysConsidered`,
        `${base}.current`,
        `${base}.target`,
        `${base}.percent`,
      ]),
    };
  }

  if (progress.status === "achieved") {
    return {
      id: `insight-${goal.id}-achieved`,
      rule: "goal-projection",
      severity: "positive",
      title: `${goal.label} — done`,
      body: `You have reached ${pretty(progress.currentValue)} against a target of ${pretty(progress.targetValue)}. ${goal.rationale}`,
      action: "Set the next milestone while the habit is still holding.",
      evidence: evidence(index, [`${base}.current`, `${base}.target`, `${base}.percent`]),
    };
  }

  const daysToProjection =
    progress.projectedDate !== null
      ? daysBetween(bundle.dataset.range.end, progress.projectedDate)
      : null;

  const onTrack = progress.status === "ahead" || progress.status === "on-track";

  const body =
    daysToProjection !== null
      ? `You are at ${pretty(progress.currentValue)} against a target of ${pretty(progress.targetValue)} — ${progress.percentComplete}% of the way from where you started. At the current pace of ${progress.actualPacePerWeek} ${goal.unit} per week, the target arrives in about ${daysToProjection} days, which is ${Math.abs(progress.daysRemaining - daysToProjection)} days ${progress.daysRemaining - daysToProjection > 0 ? "before" : "past"} your ${formatShortDate(goal.targetDate)} deadline.`
      : `You are at ${pretty(progress.currentValue)} against a target of ${pretty(progress.targetValue)} — ${progress.percentComplete}% of the way from where you started. The trend is currently flat rather than closing on the target.`;

  return {
    id: `insight-${goal.id}-projection`,
    rule: "goal-projection",
    severity: onTrack ? "positive" : "watch",
    title: onTrack ? `${goal.label} — on pace` : `${goal.label} — falling behind`,
    body,
    action: goalAction(progress, onTrack),
    evidence: evidence(index, [
      `${base}.current`,
      `${base}.target`,
      `${base}.percent`,
      `${base}.pacePerWeek`,
      `${base}.requiredPacePerWeek`,
      `${base}.daysRemaining`,
    ]),
  };
}

function trainingLoadRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const { acwr, acuteLoadMin, chronicWeeklyLoadMin } = bundle.derived;
  if (acwr === null) return null;

  if (acwr > 1.5) {
    return {
      id: "insight-load-spike",
      rule: "training-load-spike",
      severity: acwr > 1.8 ? "alert" : "watch",
      title: `Training load up ${Math.round((acwr - 1) * 100)}% on your norm`,
      body: `You have trained ${Math.round(acuteLoadMin)} minutes in the last seven days, against a four-week norm of ${Math.round(chronicWeeklyLoadMin)} minutes per week — a ratio of ${acwr.toFixed(2)}. Most running injuries occur when this ratio climbs past roughly 1.5.`,
      action:
        "Repeat this week's volume rather than increasing it. Adaptation happens during the repeat, not during the increase.",
      evidence: evidence(index, [
        "derived.acwr",
        "derived.acuteLoadMin",
        "derived.chronicWeeklyLoadMin",
      ]),
    };
  }

  if (acwr < 0.8 && chronicWeeklyLoadMin > 60) {
    return {
      id: "insight-load-drop",
      rule: "training-load-spike",
      severity: "info",
      title: "Training volume has dropped off",
      body: `This week's load is ${acwr.toFixed(2)}× your four-week norm — ${Math.round(acuteLoadMin)} minutes against a norm of ${Math.round(chronicWeeklyLoadMin)}. Aerobic gains fade measurably after roughly two weeks of reduced volume.`,
      action: "One easy 25-minute run restores most of the week; it does not need to be a full session.",
      evidence: evidence(index, [
        "derived.acwr",
        "derived.acuteLoadMin",
        "derived.chronicWeeklyLoadMin",
      ]),
    };
  }

  return null;
}

function nutritionLoggingRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const { nutritionDaysLogged30d, nutritionLoggingCompleteness } = bundle.derived;
  if (nutritionLoggingCompleteness >= 0.75) return null;

  return {
    id: "insight-nutrition-gap",
    rule: "nutrition-logging-gap",
    severity: "info",
    title: `Food logging covers ${Math.round(nutritionLoggingCompleteness * 100)}% of the last 30 days`,
    body: `You logged on ${nutritionDaysLogged30d} of the last 30 days, and partial logs under-count rather than averaging out. Any nutrition trend on this dashboard is indicative only — the app will not draw conclusions from it.`,
    action:
      "Log the days you would rather not. The unlogged days are precisely the ones that make a nutrition trend readable.",
    evidence: evidence(index, [
      "derived.nutritionCompleteness",
      "derived.nutritionDaysLogged30d",
      "caloriesConsumed.avg7d",
    ]),
    caveat:
      "This insight is about data quality, not diet. Nutrition metrics elsewhere on the dashboard carry the same limitation.",
  };
}

function cardioTrendRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const summary = bundle.summaries.restingHeartRate;
  const seven = summary?.windows.find((w) => w.window === "7d");
  const ninety = summary?.windows.find((w) => w.window === "90d");
  if (!seven || !ninety || ninety.average === 0) return null;

  const delta = seven.average - ninety.average;
  if (delta > -2) return null;

  return {
    id: "insight-cardio-trend",
    rule: "cardio-trend",
    severity: "positive",
    title: `Resting heart rate down ${Math.abs(delta).toFixed(1)} bpm`,
    body: `Your seven-day average is ${seven.average.toFixed(1)} bpm against a 90-day average of ${ninety.average.toFixed(1)} bpm. A falling resting heart rate over weeks is one of the more reliable markers of improving aerobic fitness.`,
    action: "Nothing to change here — this is the training working.",
    evidence: evidence(index, [
      "restingHeartRate.avg7d",
      "restingHeartRate.avg90d",
      "hrvMs.avg7d",
    ]),
  };
}

function weekendGapRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const gap = bundle.derived.weekendStepGap;
  if (Math.abs(gap) < 2500) return null;

  const weekday = gap > 0;
  return {
    id: "insight-weekend-gap",
    rule: "weekend-weekday-gap",
    severity: "watch",
    title: weekday ? "Weekdays are where the gap is" : "Weekends carry your step count",
    body: `You average ${Math.abs(gap).toLocaleString("en-US")} ${gap > 0 ? "fewer" : "more"} steps on ${gap > 0 ? "weekdays than weekends" : "weekends than weekdays"}. With a desk-based role, five low-movement days outweigh two active ones for metabolic health.`,
    action: weekday
      ? "A 15-minute walk after lunch on weekdays is worth more than a longer weekend session."
      : "Try to carry some of the weekend pattern into a weekday — the total matters less than the distribution.",
    evidence: evidence(index, [
      "derived.weekendStepGap",
      "steps.avg7d",
      "activeMinutes.avg7d",
    ]),
  };
}

function stepStreakRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const streak = bundle.derived.stepGoalStreakDays;
  if (streak < 3) return null;

  return {
    id: "insight-step-streak",
    rule: "step-streak",
    severity: "positive",
    title: `${streak} days in a row over 8,000 steps`,
    body: `Your longest streak in the last 30 days is ${bundle.derived.bestStepStreak30d} days, and you are currently on ${streak}.`,
    action: "Keep it going — the streak is doing more for consistency than any single long session.",
    evidence: evidence(index, [
      "derived.stepGoalStreakDays",
      "derived.bestStepStreak30d",
      "steps.avg7d",
    ]),
  };
}

function hrvTrendRule(bundle: MetricsBundle, index: RefIndex): Insight | null {
  const seven = bundle.summaries.hrvMs?.windows.find((w) => w.window === "7d");
  const thirty = bundle.summaries.hrvMs?.windows.find((w) => w.window === "30d");
  if (!seven || !thirty || thirty.average === 0) return null;

  const ratio = seven.average / thirty.average;
  if (ratio >= 0.93) return null;

  return {
    id: "insight-hrv-trend",
    rule: "hrv-trend",
    severity: ratio < 0.88 ? "watch" : "info",
    title: `HRV ${Math.round((1 - ratio) * 100)}% below your baseline`,
    body: `Your seven-day HRV averages ${seven.average.toFixed(0)} ms against a 30-day baseline of ${thirty.average.toFixed(0)} ms. HRV is best read against your own history, not a population norm — and this is your history saying you are under-recovered.`,
    action:
      "Treat the next hard session as optional. An easy day now costs less than a forced one later.",
    evidence: evidence(index, ["hrvMs.avg7d", "hrvMs.avg30d", "restingHeartRate.avg7d"]),
  };
}

// ─── Ranking ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  alert: 0,
  watch: 1,
  positive: 2,
  info: 3,
};

/** Alert first, then watch, then wins, then context. */
export function rankInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.id.localeCompare(b.id);
  });
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Goal cards, capped.
 *
 * With four goals, three of them lagging, the feed fills with goal cards and
 * stops being a feed. The primary goal always gets a card — it is the thing
 * the user actually chose — and the secondary goals compete for at most one
 * more slot, worst first. The rest stay visible in the Goals section, and the
 * assistant still sees all of them in its snapshot.
 */
function goalInsights(bundle: MetricsBundle, index: RefIndex): Insight[] {
  const { persona } = bundle.dataset;
  const cards: Insight[] = [];

  const primary = goalProjectionRule(bundle, index, persona.primaryGoal.id);
  if (primary) cards.push(primary);

  const secondary = rankInsights(
    persona.secondaryGoals
      .map((goal) => goalProjectionRule(bundle, index, goal.id))
      .filter((insight): insight is Insight => insight !== null),
  );

  return secondary.length > 0 ? [...cards, secondary[0]] : cards;
}

export function runInsightRules(bundle: MetricsBundle, index: RefIndex): Insight[] {
  const results: (Insight | null)[] = [
    sleepHeartRateRule(bundle, index),
    sleepDebtRule(bundle, index),
    trainingLoadRule(bundle, index),
    bedtimeConsistencyRule(bundle, index),
    hrvTrendRule(bundle, index),
    weekendGapRule(bundle, index),
    nutritionLoggingRule(bundle, index),
    cardioTrendRule(bundle, index),
    stepStreakRule(bundle, index),
  ];

  return rankInsights([
    ...results.filter((insight): insight is Insight => insight !== null),
    ...goalInsights(bundle, index),
  ]);
}

/** The three cards the dashboard shows before "show all". */
export function focusInsights(insights: Insight[], limit = 3): Insight[] {
  return insights.slice(0, limit);
}
