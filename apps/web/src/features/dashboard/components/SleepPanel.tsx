/**
 * Sleep. Night length is shown against the user's own 7-hour goal rather than a
 * population average, since the only meaningful question is whether they hit the
 * target they set.
 *
 * Nights the watch was not worn are absent from the series rather than drawn as
 * zero-height bars, which would read as "slept nothing".
 */

import { formatDuration, METRIC_META, minutesToClock } from "@health/core";
import ReactECharts from "echarts-for-react";

import { useAppSelector } from "@/app/hooks";
import { selectDataset, selectDerived, selectPayload, selectSeries, selectUi } from "@/features/selectors";
import { formatAxisDate, formatBare, shapeOf } from "@/shared/lib/format";
import { CHART_PALETTE } from "@/shared/lib/theme";
import { Panel } from "@/shared/ui/primitives";
import { CaveatNote, EmptyState } from "@/shared/ui/states";

const GOAL_MIN = 420; // 7h — the persona's stated goal, not a clinical norm.

const StageBar = () => {
  const dataset = useAppSelector(selectDataset);
  const palette = CHART_PALETTE[useAppSelector(selectUi).theme];

  const nights = (dataset?.daily ?? []).filter((day) => day.sleep).slice(-30);
  if (nights.length === 0) return null;

  const average = (pick: (sleep: NonNullable<(typeof nights)[number]["sleep"]>) => number) =>
    nights.reduce((total, day) => total + pick(day.sleep!), 0) / nights.length;

  const stages = [
    { key: "deep", label: "Deep", minutes: average((s) => s.deepMin), colour: palette.sleepStages.deep },
    { key: "rem", label: "REM", minutes: average((s) => s.remMin), colour: palette.sleepStages.rem },
    { key: "light", label: "Light", minutes: average((s) => s.lightMin), colour: palette.sleepStages.light },
    { key: "awake", label: "Awake", minutes: average((s) => s.awakeMin), colour: palette.sleepStages.awake },
  ];

  // Proportions are of time in bed, so the segments fill the bar exactly.
  const timeInBed = stages.reduce((sum, stage) => sum + stage.minutes, 0) || 1;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {stages.map((stage) => (
          <div
            key={stage.key}
            style={{
              width: `${(stage.minutes / timeInBed) * 100}%`,
              background: stage.colour,
            }}
            title={`${stage.label} — ${formatDuration(stage.minutes)}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {stages.map((stage) => (
          <li key={stage.key} className="flex items-center gap-1.5 text-[0.75rem]">
            <span
              className="size-2 rounded-sm"
              style={{ background: stage.colour }}
              aria-hidden
            />
            <span className="text-muted">{stage.label}</span>
            <span className="ml-auto font-medium tabular-nums text-ink">
              {formatDuration(stage.minutes)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.75rem] text-faint">
        Average night across {nights.length} recorded nights.
      </p>
    </div>
  );
};

export const SleepPanel = () => {
  const payload = useAppSelector(selectPayload);
  const derived = useAppSelector(selectDerived);
  const series = useAppSelector(selectSeries("sleepDurationMin"));
  const palette = CHART_PALETTE[useAppSelector(selectUi).theme];
  const nights = series.slice(-14);

  if (!payload || !derived) return null;

  const shape = shapeOf(METRIC_META.sleepDurationMin);
  const dataset = payload.dataset;
  const tracked = dataset.daily.filter((day) => day.sleep).length;
  const missing = dataset.daily.length - tracked;

  return (
    <Panel
      title="Sleep"
      subtitle="Last 14 nights against your 7-hour goal"
      action={
        derived.nightsTracked14d > 0 ? (
          <div className="text-right">
            <p className="text-xs font-semibold text-ink">
              {minutesToClock(derived.avgBedtimeMinutes)}
            </p>
            <p className="text-[0.72rem] text-faint">average bedtime</p>
          </div>
        ) : null
      }
    >
      {nights.length < 2 ? (
        <EmptyState
          title="No nights recorded"
          message="Sleep appears here once your watch has tracked a night or two. Nothing is shown for nights the watch was not worn — a gap is not a zero."
        />
      ) : (
        <div className="space-y-5">
          <div className="h-44 w-full mt-4">
            <ReactECharts
              option={{
                grid: { top: 20, right: 10, bottom: 20, left: 30 },
                tooltip: {
                  trigger: "axis",
                  backgroundColor: palette.tooltipBg,
                  borderColor: palette.tooltipBorder,
                  textStyle: { color: palette.tooltipText, fontSize: 12 },
                  formatter: (params: any) => {
                    const data = params[0];
                    const minutes = data.value;
                    const short = minutes < GOAL_MIN;
                    const diffText = short 
                      ? `${formatDuration(GOAL_MIN - minutes)} short of your goal`
                      : `${formatDuration(minutes - GOAL_MIN)} over your goal`;
                    
                    return `
                      <div style="font-size:11.5px; opacity:0.7;">${formatAxisDate(data.name)}</div>
                      <div style="font-weight:600; font-variant-numeric:tabular-nums; margin:2px 0;">${formatDuration(minutes)}</div>
                      <div style="font-size:11.5px; opacity:0.7;">${diffText}</div>
                    `;
                  },
                },
                xAxis: {
                  type: "category",
                  data: nights.map((d) => d.date),
                  axisLabel: { formatter: (value: string) => formatAxisDate(value), color: palette.axisText, fontSize: 10 },
                  axisLine: { show: false },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: "value",
                  max: (val: { max: number }) => val.max + 60,
                  splitLine: { lineStyle: { color: palette.grid } },
                  axisLabel: { color: palette.axisText, fontSize: 10, formatter: (value: number) => formatBare(value, shape) },
                },
                series: [
                  {
                    type: "bar",
                    data: nights.map((d) => d.value),
                    itemStyle: { color: palette.brand, borderRadius: [3, 3, 0, 0] },
                    animation: false,
                    markLine: {
                      data: [{ yAxis: GOAL_MIN, name: '7h goal' }],
                      lineStyle: { type: 'dashed', color: palette.brand },
                      label: { formatter: "7h goal", position: "insideEndTop", color: palette.axisText, fontSize: 10 },
                      symbol: ['none', 'none']
                    }
                  },
                ],
              }}
              style={{ height: "100%", width: "100%" }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-[0.85rem] font-semibold text-ink">
                Where the night goes
              </h3>
              <div className="mt-3">
                <StageBar />
              </div>
            </div>

            <div>
              <h3 className="text-[0.85rem] font-semibold text-ink">
                Rhythm and debt
              </h3>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Bedtime varies by</dt>
                  <dd className="font-medium text-ink">
                    {derived.bedtimeStdDevMin} min
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Sleep debt, 14 nights</dt>
                  <dd className="font-medium text-ink">
                    {derived.sleepDebt14dMin > 15
                      ? `${formatDuration(derived.sleepDebt14dMin)} behind`
                      : derived.sleepDebt14dMin < -15
                        ? `${formatDuration(Math.abs(derived.sleepDebt14dMin))} ahead`
                        : "balanced"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">Nights tracked</dt>
                  <dd className="font-medium text-ink">
                    {derived.nightsTracked14d} of 14
                  </dd>
                </div>
              </dl>

              {derived.bedtimeStdDevMin >= 45 ? (
                <div className="mt-3">
                  <CaveatNote>
                    A bedtime swinging by {derived.bedtimeStdDevMin} minutes fragments the
                    rhythm even when the total hours look fine.
                  </CaveatNote>
                </div>
              ) : null}
            </div>
          </div>

          {missing > 0 ? (
            <CaveatNote>
              {missing} of the last {dataset.daily.length} days have no sleep recorded — the
              watch was not worn. Those days are gaps in the averages above, not zeroes.
            </CaveatNote>
          ) : null}
        </div>
      )}
    </Panel>
  );
};
