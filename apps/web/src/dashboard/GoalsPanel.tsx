/**
 * Goals.
 *
 * The interesting thing here is that two goals are not measured the same way,
 * and the UI has to show that rather than flatten it.
 *
 * "Run 10K" is a journey: you are some fraction of the distance from where you
 * started to the target, and a progress bar is the honest picture.
 *
 * "Sleep seven hours" is a threshold: there is no meaningful 42% of the way to
 * sleeping seven hours. What is true is that you did it on eleven of the last
 * thirty nights, and that is what the card shows — a month of days, filled or
 * not. Reporting it as a percentage of a journey produced a card that said 12%
 * next to a person sleeping six and a half hours a night, which is both
 * arithmetically correct and useless.
 */

import { METRIC_META } from "@health/core";
import type { GoalProgress, MetricKey, SeriesPoint } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectDerived, selectSeries } from "@/features/selectors";
import { formatBare, formatDayMonth, formatValue, shapeOf } from "@/lib/format";
import { Badge, Bar, Card, toneText } from "@/ui/primitives";
import type { Tone } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";

const STATUS_TONE: Record<GoalProgress["status"], Tone> = {
  achieved: "positive",
  ahead: "positive",
  "on-track": "brand",
  behind: "watch",
};

const STATUS_LABEL: Record<GoalProgress["status"], string> = {
  achieved: "Achieved",
  ahead: "Ahead of pace",
  "on-track": "On track",
  behind: "Behind pace",
};

/**
 * The last thirty days as filled or hollow dots.
 *
 * Derived in the browser from the same series the chart draws. That is
 * presentation of a raw series rather than a second analytics implementation —
 * the goal's verdict, pace and projection all come from the server.
 */
function ThresholdGrid({
  goal,
  series,
}: {
  goal: GoalProgress["goal"];
  series: SeriesPoint[];
}) {
  const recent = series.slice(-30);
  const meets = (value: number) =>
    goal.direction === "increase" ? value >= goal.targetValue : value <= goal.targetValue;

  return (
    <ul className="flex flex-wrap gap-1" aria-hidden>
      {recent.map((point) => (
        <li
          key={point.date}
          title={`${formatDayMonth(point.date)} — ${formatValue(point.value, shapeOf(METRIC_META[goal.metric]))}`}
          className={`size-3 rounded-[3px] ${
            meets(point.value) ? "bg-positive" : "bg-raised border border-line"
          }`}
        />
      ))}
    </ul>
  );
}

function JourneyCard({ progress }: { progress: GoalProgress }) {
  const { goal } = progress;
  const shape = shapeOf(METRIC_META[goal.metric]);
  const tone = STATUS_TONE[progress.status];

  const paceDelta = progress.actualPacePerWeek - progress.requiredPacePerWeek;
  const paceTone: Tone = paceDelta >= 0 ? "positive" : "watch";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{goal.label}</h3>
        <Badge tone={tone}>{STATUS_LABEL[progress.status]}</Badge>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">{progress.summary}</p>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums text-ink">
          {formatBare(progress.currentValue, shape)}
          <span className="ml-1 text-xs font-normal text-faint">{shape.unit}</span>
        </span>
        <span className="text-xs text-faint">
          target {formatValue(progress.targetValue, shape)}
        </span>
      </div>

      <Bar
        value={progress.percentComplete}
        tone={tone}
        label={`${goal.label} progress`}
        className="mt-2"
      />

      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>{progress.percentComplete}% of the way</span>
        <span>
          {progress.daysRemaining > 0
            ? `${progress.daysRemaining} days left`
            : "target date passed"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px]">
        <div>
          <dt className="text-faint">Your pace</dt>
          <dd className={`font-medium ${toneText(paceTone)}`}>
            {progress.actualPacePerWeek.toFixed(1)} {goal.unit}/week
          </dd>
        </div>
        <div>
          <dt className="text-faint">Needed</dt>
          <dd className="font-medium text-muted">
            {progress.requiredPacePerWeek.toFixed(1)} {goal.unit}/week
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-faint">Projected</dt>
          <dd className="text-muted">
            {progress.projectedDate
              ? `${formatDayMonth(progress.projectedDate)} at your current pace`
              : "Not enough recent data to project"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ThresholdCard({ progress, series }: { progress: GoalProgress; series: SeriesPoint[] }) {
  const { goal } = progress;
  const shape = shapeOf(METRIC_META[goal.metric]);
  const tone = STATUS_TONE[progress.status];

  const met = progress.daysMet ?? 0;
  const considered = progress.daysConsidered ?? 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{goal.label}</h3>
        <Badge tone={tone}>{STATUS_LABEL[progress.status]}</Badge>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">{progress.summary}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums text-ink">
          {met}
          <span className="text-faint">/{considered}</span>
        </span>
        <span className="text-xs text-faint">days met, last 30</span>
      </div>

      <Bar
        value={progress.percentComplete}
        tone={tone}
        label={`${goal.label} consistency`}
        className="mt-2"
      />
      <p className="mt-1.5 text-[11px] text-faint">
        A consistency goal, not a distance one — {formatValue(goal.targetValue, shape)} on the
        day is what counts.
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <ThresholdGrid goal={goal} series={series} />
        <p className="mt-2 text-[11px] text-faint">
          Filled means the target was met. Each square is one recorded day.
        </p>
      </div>
    </Card>
  );
}

function GoalCard({ progress }: { progress: GoalProgress }) {
  const series = useAppSelector(selectSeries(progress.goal.metric as MetricKey));
  return progress.goal.kind === "threshold" ? (
    <ThresholdCard progress={progress} series={series} />
  ) : (
    <JourneyCard progress={progress} />
  );
}

export function GoalsPanel() {
  const derived = useAppSelector(selectDerived);

  if (!derived || derived.goalProgress.length === 0) {
    return (
      <EmptyState
        title="No goals set"
        message="Goals turn a stream of measurements into something you can be ahead or behind on. Setting one takes a target and a date."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {derived.goalProgress.map((progress) => (
        <GoalCard key={progress.goal.id} progress={progress} />
      ))}
    </div>
  );
}
