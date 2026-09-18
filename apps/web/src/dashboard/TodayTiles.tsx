/**
 * Today, in four numbers.
 *
 * Each tile shows the latest reading, how it compares with the last seven
 * days, and the shape of those seven days. The comparison is the part that
 * makes a number mean something: "7,412 steps" is a fact, "7,412 steps, 12%
 * below your week" is information.
 *
 * Values come from the precomputed series and summary windows rather than
 * being re-derived from the daily records — the server already decided what
 * "latest sleep duration" means (including which nights are gaps), and this
 * screen is not entitled to a second opinion.
 */

import { METRIC_META } from "@health/core";
import type { MetricKey } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectPayload, selectSummary, selectSeries } from "@/features/selectors";
import { formatBare, formatChange, trendOf, unitSuffix } from "@/lib/format";
import { shapeOf } from "@/lib/format";
import { TREND_TONE } from "@/lib/theme";
import { Card, Sparkline, toneText } from "@/ui/primitives";

const TILES: MetricKey[] = ["steps", "sleepDurationMin", "restingHeartRate", "hrvMs"];

const Tile = ({ metric }: { metric: MetricKey }) => {
  const meta = METRIC_META[metric];
  const summary = useAppSelector(selectSummary(metric));
  const series = useAppSelector(selectSeries(metric));

  const week = summary?.windows.find((w) => w.window === "7d") ?? null;

  if (!week) {
    return (
      <Card className="p-4">
        <p className="text-xs font-medium text-muted">{meta.shortLabel}</p>
        <p className="mt-3 text-sm text-faint">Not recorded yet</p>
      </Card>
    );
  }

  const shape = shapeOf(meta);
  const trend = trendOf(week.changePct, meta.goodDirection);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{meta.shortLabel}</p>
        <Sparkline
          points={series.slice(-30)}
          tone={TREND_TONE[trend]}
          width={64}
          height={22}
        />
      </div>

      <p className="mt-2.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none tracking-tight text-ink">
          {formatBare(week.latest, shape)}
        </span>
        {unitSuffix(shape) ? (
          <span className="text-xs font-medium text-faint">{unitSuffix(shape)}</span>
        ) : null}
      </p>

      <p className="mt-2 text-[11px] leading-tight">
        <span className={`font-medium ${toneText(TREND_TONE[trend])}`}>
          {formatChange(week.changePct)}
        </span>
        <span className="text-faint"> vs previous 7 days</span>
      </p>

      {/* Sample count is not decoration: a 7-day average over 3 recorded days
          is a different claim from one over 7, and the tile should not hide
          which it is. */}
      {week.sampleCount < week.days ? (
        <p className="mt-1 text-[10px] text-faint">
          from {week.sampleCount} of {week.days} days
        </p>
      ) : null}
    </Card>
  );
};

export const TodayTiles = () => {
  const payload = useAppSelector(selectPayload);
  if (!payload) return null;

  // A brand-new user has no metric history at all; the tiles would be four
  // cards reading "not recorded", which is worse than saying it once.
  const hasAnySeries = TILES.some((metric) => (payload.series[metric]?.length ?? 0) > 0);
  if (!hasAnySeries) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Your recent numbers</h2>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
          Nothing has been recorded yet. Once your watch syncs a day or two of data, this row
          fills in with your latest reading for each metric and how it compares with the week
          before.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((metric) => (
        <Tile key={metric} metric={metric} />
      ))}
    </div>
  );
};
