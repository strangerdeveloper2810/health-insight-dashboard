/**
 * Nutrition — and the one thing a nutrition panel usually gets wrong.
 *
 * Food logging is incomplete. In this dataset roughly seven days in ten carry
 * a record, and the days that are missing are not random: people log on
 * ordinary days and skip the ones that are messy. So the averages here are
 * averages *of what was logged*, which undercounts what was eaten.
 *
 * The completeness figure is therefore not a footnote, it is the headline.
 * A calorie average presented without it invites a decision the data cannot
 * support, and the app would rather say "this is 70% of your days" than imply
 * a precision it does not have.
 */

import { METRIC_META } from "@health/core";
import type { MetricKey, NutritionRecord } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectDataset, selectDerived } from "@/features/selectors";
import { Bar, Panel, toneText } from "@/ui/primitives";
import type { Tone } from "@/ui/primitives";
import { CaveatNote, EmptyState } from "@/ui/states";

interface MacroRow {
  label: string;
  metric: MetricKey;
  pick: (record: NutritionRecord) => number;
  hint?: string;
}

const MACROS: MacroRow[] = [
  { label: "Protein", metric: "proteinG", pick: (r) => r.proteinG },
  { label: "Carbohydrate", metric: "carbsG", pick: (r) => r.carbsG },
  { label: "Fat", metric: "fatG", pick: (r) => r.fatG },
  { label: "Sodium", metric: "sodiumMg", pick: (r) => r.sodiumMg },
];

export const NutritionPanel = () => {
  const dataset = useAppSelector(selectDataset);
  const derived = useAppSelector(selectDerived);

  if (!dataset || !derived) return null;

  const logged = dataset.daily.filter((day) => day.nutrition);
  const completeness = derived.nutritionLoggingCompleteness;

  if (logged.length === 0) {
    return (
      <Panel title="Nutrition" subtitle="Intake from your food log">
        <EmptyState
          title="Nothing logged yet"
          message="Nutrition appears here once meals have been logged. Nothing is estimated on your behalf — an empty log and a day of eating nothing are different things, and this panel will not confuse them."
        />
      </Panel>
    );
  }

  const mean = (pick: (record: NutritionRecord) => number) =>
    logged.reduce((total, day) => total + pick(day.nutrition!), 0) / logged.length;

  const calories = mean((r) => r.calories);
  const water = mean((r) => r.waterMl);
  const avgCompleteness = mean((r) => r.completeness);

  const tone: Tone = completeness >= 0.85 ? "positive" : completeness >= 0.6 ? "watch" : "alert";

  // Rough share of energy from each macro, for the split bar. 4/4/9 kcal per
  // gram — the standard Atwater factors, stated here so the arithmetic is
  // checkable rather than magic.
  const proteinKcal = mean((r) => r.proteinG) * 4;
  const carbKcal = mean((r) => r.carbsG) * 4;
  const fatKcal = mean((r) => r.fatG) * 9;
  const macroTotal = proteinKcal + carbKcal + fatKcal || 1;

  return (
    <Panel
      title="Nutrition"
      subtitle={`Averages across ${logged.length} logged days`}
      action={
        <div className="text-right">
          <p className={`text-xs font-semibold ${toneText(tone)}`}>
            {Math.round(completeness * 100)}% of days logged
          </p>
          <p className="text-[10px] text-faint">last 30 days</p>
        </div>
      }
    >
      <div className="space-y-5">
        {completeness < 0.85 ? (
          <CaveatNote>
            These are averages of the days you logged, which are{" "}
            {Math.round(completeness * 100)}% of the last month — and the days people skip
            tend to be the unusual ones. Treat them as a floor, not a measurement.
          </CaveatNote>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-faint">Energy</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {Math.round(calories).toLocaleString("en-US")}
              <span className="ml-1 text-[10px] font-normal text-faint">kcal</span>
            </p>
          </div>
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-faint">Water</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {(water / 1000).toFixed(1)}
              <span className="ml-1 text-[10px] font-normal text-faint">L</span>
            </p>
          </div>
          <div className="col-span-2 rounded-lg border border-line bg-raised px-3 py-2.5 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-faint">Log detail</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {Math.round(avgCompleteness * 100)}
              <span className="ml-1 text-[10px] font-normal text-faint">% per day</span>
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Where the energy comes from
            </h3>
            <span className="text-[10px] text-faint">share of logged calories</span>
          </div>

          <div className="mt-2.5 flex h-3 overflow-hidden rounded-full">
            <div style={{ width: `${(proteinKcal / macroTotal) * 100}%` }} className="bg-brand" />
            <div style={{ width: `${(carbKcal / macroTotal) * 100}%` }} className="bg-info" />
            <div style={{ width: `${(fatKcal / macroTotal) * 100}%` }} className="bg-watch" />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {MACROS.map((macro) => {
              const meta = METRIC_META[macro.metric];
              const value = mean(macro.pick);
              return (
                <div key={macro.metric}>
                  <dt className="text-[11px] text-faint">{macro.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-ink">
                    {value.toFixed(meta.precision)}
                    <span className="ml-1 text-[10px] font-normal text-faint">{meta.unit}</span>
                  </dd>
                  <Bar
                    value={(value / (meta.unit === "mg" ? 3000 : 200)) * 100}
                    tone="muted"
                    label={`${macro.label} relative share`}
                    className="mt-1.5"
                  />
                </div>
              );
            })}
          </dl>
          <p className="mt-2 text-[11px] text-faint">
            The bars under each figure are a rough sense of proportion between them, not
            targets — this app does not know your energy requirements.
          </p>
        </div>
      </div>
    </Panel>
  );
};
