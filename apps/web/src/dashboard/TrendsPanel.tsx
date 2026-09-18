/**
 * The trend chart.
 *
 * Two decisions worth naming.
 *
 * The shaded spans are life events, not decorations. A resting heart rate that
 * climbed eight beats over a week is alarming on its own and obvious once the
 * flu is shaded underneath it. Most of what looks like a health trend is a
 * life event, and a chart that hides them is a chart that misleads.
 *
 * Gaps stay gaps. Days with no recording are absent from the series, and the
 * line breaks rather than dropping to zero — a zero would read as "you walked
 * nowhere", which is a different and false claim from "the watch was charging".
 */

import { addDays, METRIC_META } from "@health/core";
import type { ChartAnnotation, MetricKey, WindowedStat } from "@health/core";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  selectAnnotations,
  selectPayload,
  selectTrendPoints,
  selectTrendSummary,
  selectUi,
} from "@/features/selectors";
import { eventsToggled, trendMetricChanged, trendRangeChanged } from "@/features/uiSlice";
import type { TrendRange } from "@/features/uiSlice";
import { formatAxisDate, formatBare, formatChange, shapeOf, trendOf, unitSuffix } from "@/lib/format";
import { sectionIndex } from "@/lib/sections";
import { CHART_PALETTE, EVENT_COLOURS, TREND_TONE } from "@/lib/theme";
import { Badge, Panel, toneText } from "@/ui/primitives";

const RANGES: TrendRange[] = ["7d", "30d", "90d"];
const RANGE_LABEL: Record<TrendRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};

interface TooltipEntry {
  value?: number | string;
}

const ChartTooltip = ({
  active,
  payload,
  label,
  unit,
  precision,
  format,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit: string;
  precision: number;
  format?: "number" | "duration" | "clock";
}) => {
  // Read before the early return: a hook after a conditional exit is a hook
  // whose call count depends on the data.
  const theme = useAppSelector(selectUi).theme;
  if (!active || !payload?.length) return null;

  const palette = CHART_PALETTE[theme];

  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;

  return (
    <div
      className="rounded-control border px-2.5 py-1.5 text-[0.8rem] shadow-lift"
      style={{
        background: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        color: palette.tooltipText,
      }}
    >
      <div className="text-[0.72rem] opacity-70">{label ? formatAxisDate(label) : ""}</div>
      <div className="font-semibold tabular-nums">
        {formatBare(value, { unit, precision, format })}
        {unitSuffix({ unit, precision, format }) ? (
          <span className="ml-1 text-[0.72rem] font-normal opacity-70">
            {unitSuffix({ unit, precision, format })}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const statLine = (stat: WindowedStat, unit: string, precision: number): string => {
  const shape = { unit, precision, format: undefined };
  return `avg ${formatBare(stat.average, shape)} · low ${formatBare(stat.min, shape)} · high ${formatBare(stat.max, shape)}`;
};

export const TrendsPanel = () => {
  const dispatch = useAppDispatch();
  const payload = useAppSelector(selectPayload);
  const ui = useAppSelector(selectUi);
  const points = useAppSelector(selectTrendPoints);
  const annotations = useAppSelector(selectAnnotations);
  const summary = useAppSelector(selectTrendSummary);
  const palette = CHART_PALETTE[ui.theme];

  if (!payload) return null;

  const meta = METRIC_META[ui.trendMetric];
  const shape = shapeOf(meta);
  const trend = trendOf(summary?.changePct ?? null, meta.goodDirection);
  const tone = TREND_TONE[trend];

  // Only offer metrics that have something to draw, so the picker never
  // presents a choice that leads to an empty chart.
  const choices = (Object.keys(payload.series) as MetricKey[]).filter(
    (key) => (payload.series[key]?.length ?? 0) > 1,
  );

  const events = payload.dataset.events;

  return (
    <Panel
      id="trends"
      index={sectionIndex("trends")}
      title="Trends"
      subtitle={summary ? statLine(summary, meta.unit, meta.precision) : meta.description}
      action={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="trend-metric">
            Metric
          </label>
          {/* A native select sizes itself to its longest option — "Resting heart
              rate" — which is wider than a phone. Capping it keeps the header
              row inside the panel instead of pushing the page sideways. */}
          <select
            id="trend-metric"
            value={ui.trendMetric}
            onChange={(event) => dispatch(trendMetricChanged(event.target.value as MetricKey))}
            className="min-w-0 max-w-[11rem] flex-1 rounded-control bg-raised px-2 py-1 text-xs text-ink sm:flex-none"
          >
            {choices.map((key) => (
              <option key={key} value={key}>
                {METRIC_META[key].label}
              </option>
            ))}
          </select>

          <div
            className="flex rounded-control bg-raised p-0.5"
            role="group"
            aria-label="Time range"
          >
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => dispatch(trendRangeChanged(range))}
                aria-pressed={ui.trendRange === range}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  ui.trendRange === range
                    ? "bg-brand text-brand-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {RANGE_LABEL[range]}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {points.length < 2 ? (
        <div className="grid h-64 place-items-center text-center">
          <div>
            <p className="text-sm font-medium text-ink">Not enough data to plot</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              {meta.label} needs at least two recorded days in this window. Try a longer range.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums text-ink">
              {formatBare(summary?.average ?? 0, shape)}
            </span>
            {unitSuffix(shape) ? (
              <span className="text-xs text-faint">{unitSuffix(shape)} average</span>
            ) : null}
            <span className={`text-xs font-medium ${toneText(tone)}`}>
              {formatChange(summary?.changePct ?? null)}
            </span>
            <span className="text-xs text-faint">
              vs previous {RANGE_LABEL[ui.trendRange]}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.brand} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={palette.brand} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={palette.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  tick={{ fill: palette.axisText, fontSize: 11 }}
                  axisLine={{ stroke: palette.axis }}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: palette.axisText, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(value: number) => formatBare(value, shape)}
                />
                <Tooltip
                  content={<ChartTooltip unit={meta.unit} precision={meta.precision} format={shape.format} />}
                  cursor={{ stroke: palette.axis, strokeDasharray: "3 3" }}
                />

                {annotations.map((annotation: ChartAnnotation) => (
                  <ReferenceArea
                    key={`${annotation.date}-${annotation.label}`}
                    // A one-day event would be zero pixels wide, so it is
                    // widened to the day it happened.
                    x1={annotation.date}
                    x2={annotation.endDate ?? addDays(annotation.date, 1)}
                    fill={EVENT_COLOURS[annotation.kind]}
                    fillOpacity={0.09}
                    stroke={EVENT_COLOURS[annotation.kind]}
                    strokeOpacity={0.28}
                    strokeDasharray="3 3"
                  />
                ))}

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={palette.brand}
                  strokeWidth={2}
                  fill="url(#trend-fill)"
                  // Gaps stay gaps: without this a missing day would be
                  // bridged as if it had been measured.
                  connectNulls={false}
                  dot={points.length <= 14 ? { r: 2.5, fill: palette.brand, strokeWidth: 0 } : false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {events.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => dispatch(eventsToggled())}
                aria-pressed={ui.showEvents}
                className="text-[0.75rem] font-medium text-brand underline-offset-2 hover:underline"
              >
                {ui.showEvents ? "Hide life events" : "Show life events"}
              </button>
              {ui.showEvents ? (
                <ul className="flex flex-wrap gap-1.5">
                  {annotations.length === 0 ? (
                    <li className="text-[0.75rem] text-faint">
                      none fall inside this window
                    </li>
                  ) : (
                    annotations.map((annotation) => (
                      <li key={`${annotation.date}-${annotation.label}`}>
                        <Badge tone="muted" className="font-normal">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: EVENT_COLOURS[annotation.kind] }}
                            aria-hidden
                          />
                          {annotation.label}
                        </Badge>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
};
