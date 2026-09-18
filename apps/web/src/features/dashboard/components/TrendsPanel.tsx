/**
 * The trend chart, with life events shaded behind the line — most of what looks
 * like a health trend is a life event, and a chart that hides them misleads.
 */

import { addDays, METRIC_META } from "@health/core";
import type { ChartAnnotation, MetricKey, WindowedStat } from "@health/core";
import ReactECharts from "echarts-for-react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  selectAnnotations,
  selectPayload,
  selectTrendPoints,
  selectTrendSummary,
  selectUi,
} from "@/features/selectors";
import { eventsToggled, trendMetricChanged, trendRangeChanged } from "@/features/layout/slice";
import type { TrendRange } from "@/features/layout/slice";
import { formatAxisDate, formatBare, formatChange, shapeOf, trendOf, unitSuffix } from "@/shared/lib/format";
import { sectionIndex } from "@/shared/lib/sections";
import { CHART_PALETTE, EVENT_COLOURS, TREND_TONE } from "@/shared/lib/theme";
import { Badge, Panel, toneText } from "@/shared/ui/primitives";

const RANGES: TrendRange[] = ["7d", "30d", "90d"];
const RANGE_LABEL: Record<TrendRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
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

  // Only metrics with something to draw, so the picker never offers a choice that
  // leads to an empty chart.
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

          <div className="h-64 w-full mt-4">
            <ReactECharts
              option={{
                grid: { top: 20, right: 10, bottom: 20, left: 40 },
                tooltip: {
                  trigger: "axis",
                  backgroundColor: palette.tooltipBg,
                  borderColor: palette.tooltipBorder,
                  textStyle: { color: palette.tooltipText, fontSize: 12 },
                  formatter: (params: any) => {
                    const data = params[0];
                    const value = data.value;
                    const suffix = unitSuffix(shape) ? ` <span style="font-size:11.5px;opacity:0.7;">${unitSuffix(shape)}</span>` : "";
                    return `
                      <div style="font-size:11.5px; opacity:0.7;">${formatAxisDate(data.name)}</div>
                      <div style="font-weight:600; font-variant-numeric:tabular-nums; margin:2px 0;">${formatBare(value, shape)}${suffix}</div>
                    `;
                  },
                },
                xAxis: {
                  type: "category",
                  data: points.map((d) => d.date),
                  axisLabel: { formatter: (value: string) => formatAxisDate(value), color: palette.axisText, fontSize: 11 },
                  axisLine: { lineStyle: { color: palette.axis } },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: "value",
                  scale: true,
                  splitLine: { lineStyle: { color: palette.grid } },
                  axisLabel: { color: palette.axisText, fontSize: 11, formatter: (value: number) => formatBare(value, shape) },
                },
                series: [
                  {
                    type: "line",
                    data: points.map((d) => d.value),
                    itemStyle: { color: palette.brand },
                    areaStyle: {
                      color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: palette.brandFill }, { offset: 1, color: "rgba(255,255,255,0)" }]
                      }
                    },
                    lineStyle: { width: 2 },
                    symbol: points.length <= 14 ? "circle" : "none",
                    symbolSize: 5,
                    animation: false,
                    connectNulls: false,
                    markArea: {
                      itemStyle: { opacity: 0.09 },
                      data: annotations.map((ann: ChartAnnotation) => [
                        {
                          name: ann.label,
                          xAxis: ann.date,
                          itemStyle: { color: EVENT_COLOURS[ann.kind] },
                        },
                        {
                          xAxis: ann.endDate ?? addDays(ann.date, 1),
                        }
                      ])
                    }
                  },
                ],
              }}
              style={{ height: "100%", width: "100%" }}
            />
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
