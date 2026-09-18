/**
 * Print everything the dashboard computes, as text.
 *
 * The rules in `insights.ts` and the coefficients in `dataset.ts` are tuned by
 * reading this, not by reading the UI — the numbers are the product, and this
 * shows them without a browser in the way.
 *
 *   pnpm inspect
 *   pnpm inspect --seed 1234 --days 180
 */

import {
  buildDashboard,
  createDefaultDataset,
  estimateTokens,
  buildDataSnapshot,
  buildSystemPrompt,
  minutesToClock,
} from "../packages/core/src/index";

const arg = (name: string, fallback: number): number => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const seed = arg("seed", 20260918);
const days = arg("days", 90);

const dataset = createDefaultDataset({ seed, days });
const model = buildDashboard(dataset);

const rule = (title: string) => {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
};

rule(`DATASET  ${dataset.range.start} → ${dataset.range.end}  (${dataset.range.days} days, seed ${seed})`);
console.log(`persona: ${dataset.persona.name}, ${dataset.persona.age}`);
console.log(`workouts: ${dataset.workouts.length}   events: ${dataset.events.length}`);

rule("READINESS");
console.log(`${model.readiness.score}/100  ${model.readiness.band.toUpperCase()}  — ${model.readiness.headline}`);
for (const component of model.readiness.components) {
  console.log(`\n  ${component.label}  ${component.score}/100  (weight ${component.weight})`);
  console.log(`  ${component.explanation}`);
  for (const input of component.inputs) {
    console.log(`    · ${input.label}: ${input.value}  [${input.contribution}]`);
  }
}

rule(`INSIGHTS (${model.insights.length})`);
for (const insight of model.insights) {
  console.log(`\n[${insight.severity.toUpperCase()}] ${insight.title}`);
  console.log(`  ${insight.body}`);
  console.log(`  → ${insight.action}`);
  if (insight.caveat) console.log(`  ! ${insight.caveat}`);
  console.log(`  evidence: ${insight.evidence.map((e) => e.ref).join(", ") || "(none)"}`);
}

rule("GOALS");
for (const progress of model.bundle.derived.goalProgress) {
  const kind = progress.goal.kind === "threshold" ? "threshold" : "journey  ";
  const detail =
    progress.daysMet !== null
      ? `${progress.daysMet}/${progress.daysConsidered} days met`
      : `projected ${progress.projectedDate ?? "—"}`;
  console.log(
    `  [${kind}] ${progress.goal.id.padEnd(11)} ${String(progress.percentComplete).padStart(3)}%  ${progress.status.padEnd(9)} ${detail}`,
  );
}

rule("DERIVED");
const { derived } = model.bundle;
console.log(
  [
    `sleep debt 14d      ${derived.sleepDebt14dMin} min`,
    `nights tracked      ${derived.nightsTracked14d}`,
    `avg bedtime         ${minutesToClock(derived.avgBedtimeMinutes)}`,
    `bedtime std dev     ${derived.bedtimeStdDevMin} min`,
    `ACWR                ${derived.acwr?.toFixed(2) ?? "n/a"}`,
    `acute / chronic     ${derived.acuteLoadMin} / ${Math.round(derived.chronicWeeklyLoadMin)} min`,
    `nutrition coverage  ${(derived.nutritionLoggingCompleteness * 100).toFixed(0)}%`,
    `step streak         ${derived.stepGoalStreakDays} (best ${derived.bestStepStreak30d})`,
    `weekend step gap    ${derived.weekendStepGap}`,
  ].join("\n"),
);

if (derived.sleepHeartRateLink) {
  const link = derived.sleepHeartRateLink;
  console.log(
    `\nsleep → resting HR  short ${link.avgRhrAfterShortSleep} bpm (n=${link.shortSleepNights})` +
      ` vs normal ${link.avgRhrAfterNormalSleep} bpm (n=${link.normalNights})` +
      ` = +${link.deltaBpm} bpm`,
  );
}

rule("ASSISTANT CONTEXT");
const system = buildSystemPrompt(dataset.persona);
const snapshot = buildDataSnapshot({
  bundle: model.bundle,
  readiness: model.readiness,
  insights: model.insights,
  index: model.index,
});
console.log(`citable refs        ${model.index.refs.size}`);
console.log(`system prompt       ~${estimateTokens(system)} tokens`);
console.log(`data snapshot       ~${estimateTokens(snapshot)} tokens`);
console.log(`cached prefix total ~${estimateTokens(system) + estimateTokens(snapshot)} tokens`);
console.log(`\nfirst catalogue lines:`);
for (const ref of [...model.index.refs.values()].slice(0, 5)) {
  console.log(`  ${ref.ref} = ${ref.value} ${ref.unit}`);
}
