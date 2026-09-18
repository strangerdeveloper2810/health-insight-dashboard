/**
 * Activity and training load.
 *
 * The load ratio is the reason this panel exists. Weekly volume on its own
 * says how much someone ran; the ratio of this week to their own four-week
 * norm says whether that was a sensible amount *for them* — 40km is a quiet
 * week for one runner and a spike for another. The bands are the standard
 * ones, and the panel names them rather than colouring a number and leaving
 * the reader to guess what "1.42" means.
 */

import { formatDuration } from "@health/core";
import type { Workout, WorkoutType } from "@health/core";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppSelector } from "@/app/hooks";
import { selectDataset, selectDerived, selectSeries, selectUi } from "@/features/selectors";
import { formatDayMonth } from "@/lib/format";
import { CHART_PALETTE } from "@/lib/theme";
import { Panel, toneText } from "@/ui/primitives";
import type { Tone } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";

const WORKOUT_LABEL: Record<WorkoutType, string> = {
  run: "Run",
  walk: "Walk",
  strength: "Strength",
  cycle: "Cycle",
  yoga: "Yoga",
  swim: "Swim",
};

/** The standard acute:chronic bands, and what each one means in practice. */
function loadBand(ratio: number | null): { tone: Tone; label: string; note: string } {
  if (ratio === null) {
    return { tone: "muted", label: "Not enough history", note: "Four weeks of training gives this a baseline to compare against." };
  }
  if (ratio < 0.8) {
    return { tone: "info", label: "Below your norm", note: "Lighter than your usual four weeks — fine for a recovery week, worth noticing otherwise." };
  }
  if (ratio <= 1.3) {
    return { tone: "positive", label: "In your sweet spot", note: "This week's load sits close to what you have been consistently handling." };
  }
  if (ratio <= 1.5) {
    return { tone: "watch", label: "Ramping up", note: "A meaningful step above your norm. The kind of week that is fine once and costly repeated." };
  }
  return { tone: "alert", label: "Sharp spike", note: "Well above what you have been doing. Injury risk climbs fastest in exactly this range." };
}

function WorkoutRow({ workout }: { workout: Workout }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised text-[10px] font-semibold uppercase text-muted">
        {workout.type.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">
          {WORKOUT_LABEL[workout.type]}
          {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(2)} km` : ""}
        </p>
        <p className="text-[11px] text-faint">
          {formatDayMonth(workout.date)} · {formatDuration(workout.durationMin)} ·{" "}
          {workout.avgHeartRate} bpm avg
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-faint">RPE {workout.perceivedEffort}</span>
    </li>
  );
}

export function ActivityPanel() {
  const dataset = useAppSelector(selectDataset);
  const derived = useAppSelector(selectDerived);
  const weekly = useAppSelector(selectSeries("weeklyRunKm"));
  const palette = CHART_PALETTE[useAppSelector(selectUi).theme];

  if (!dataset || !derived) return null;

  const band = loadBand(derived.acwr);
  const recent = [...dataset.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <Panel
      title="Activity"
      subtitle="Training volume, load and recent sessions"
      action={
        <div className="text-right">
          <p className={`text-xs font-semibold ${toneText(band.tone)}`}>{band.label}</p>
          <p className="text-[10px] text-faint">
            {derived.acwr === null ? "load ratio" : `load ratio ${derived.acwr.toFixed(2)}`}
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        {weekly.length < 2 ? (
          <EmptyState
            title="No runs recorded"
            message="Weekly distance appears once there is more than one week of running to compare. Other activity below is unaffected."
          />
        ) : (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={palette.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayMonth}
                  tick={{ fill: palette.axisText, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: palette.axisText, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(value: number) => `${value}`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(127,127,127,0.08)" }}
                  contentStyle={{
                    background: palette.tooltipBg,
                    border: `1px solid ${palette.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: palette.tooltipText,
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)} km`, "Weekly distance"]}
                  labelFormatter={(label) => `Week of ${formatDayMonth(String(label))}`}
                />
                <Bar dataKey="value" fill={palette.alt} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-faint">This week</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">
              {formatDuration(derived.acuteLoadMin)}
            </dd>
          </div>
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-faint">4-week norm</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">
              {formatDuration(derived.chronicWeeklyLoadMin)}
              <span className="ml-1 text-[10px] font-normal text-faint">/week</span>
            </dd>
          </div>
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-faint">Step streak</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">
              {derived.stepGoalStreakDays}
              <span className="ml-1 text-[10px] font-normal text-faint">
                days · best {derived.bestStepStreak30d}
              </span>
            </dd>
          </div>
          <div className="rounded-lg border border-line bg-raised px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-faint">Weekend gap</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">
              {derived.weekendStepGap > 0 ? "+" : "−"}
              {Math.abs(derived.weekendStepGap).toLocaleString("en-US")}
              <span className="ml-1 text-[10px] font-normal text-faint">steps</span>
            </dd>
          </div>
        </dl>

        <p className="text-[11px] leading-relaxed text-muted">{band.note}</p>

        {recent.length > 0 ? (
          <div className="border-t border-line pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Recent sessions
            </h3>
            <ul className="mt-1 divide-y divide-line">
              {recent.map((workout) => (
                <WorkoutRow key={workout.id} workout={workout} />
              ))}
            </ul>
          </div>
        ) : null}

        {dataset.workouts.length > 0 ? (
          <p className="text-[11px] text-faint">
            {dataset.workouts.length} sessions recorded across the last{" "}
            {dataset.range.days} days.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
