import { METRIC_META } from "@health/core";
import type { MetricKey } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectSeries, selectSummary } from "@/features/selectors";
import { formatBare, formatChange, shapeOf, trendOf, unitSuffix } from "@/lib/format";
import { TREND_TONE } from "@/lib/theme";
import { useCountUp } from "@/lib/useCountUp";
import { Sparkline, toneText } from "@/ui/primitives";

/**
 * One number, how it compares with the week before, and the shape of the month.
 * The comparison is the part that makes the figure mean something, so it is never
 * dropped for space.
 */
export const MetricTile = ({ metric }: { metric: MetricKey }) => {
  const meta = METRIC_META[metric];
  const summary = useAppSelector(selectSummary(metric));
  const series = useAppSelector(selectSeries(metric));

  const week = summary?.windows.find((w) => w.window === "7d") ?? null;

  // Called before the early return: the "not recorded yet" tile is another render
  // of this same component, and a hook cannot be skipped.
  const counted = useCountUp(week?.latest ?? 0);

  if (!week) {
    return (
      <div className="bg-surface p-4 sm:p-5">
        <p className="text-[0.78rem] font-medium text-muted">{meta.shortLabel}</p>
        <p className="mt-3 text-[0.85rem] text-faint">Not recorded yet</p>
      </div>
    );
  }

  const shape = shapeOf(meta);
  const trend = trendOf(week.changePct, meta.goodDirection);

  return (
    <div className="bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.78rem] font-medium text-muted">{meta.shortLabel}</p>
        <Sparkline
          points={series.slice(-30)}
          tone={TREND_TONE[trend]}
          width={64}
          height={24}
          className="-mt-0.5 shrink-0"
        />
      </div>

      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.025em] text-ink">
          {formatBare(counted, shape)}
        </span>
        {unitSuffix(shape) ? (
          <span className="text-[0.8rem] font-medium text-faint">{unitSuffix(shape)}</span>
        ) : null}
      </p>

      <p className="mt-2.5 text-[0.78rem] leading-tight">
        <span className={`font-semibold ${toneText(TREND_TONE[trend])}`}>
          {formatChange(week.changePct)}
        </span>
        <span className="text-faint"> vs previous 7 days</span>
      </p>

      {/* A 7-day average over 3 recorded days is a different claim from one over
          7, and the tile should not hide which it is. */}
      {week.sampleCount < week.days ? (
        <p className="mt-1 text-[0.72rem] text-faint">
          from {week.sampleCount} of {week.days} days
        </p>
      ) : null}
    </div>
  );
};
