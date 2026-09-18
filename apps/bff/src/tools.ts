/**
 * The assistant's tools.
 *
 * Each description is written for the model, not for a reader of this file.
 * The most important sentence in each one is the third: when *not* to call it.
 * The snapshot already carries every headline figure, so a tool that gets
 * called for "what is my average sleep" wastes a round trip and adds latency
 * to an answer the model could already give. The descriptions exist to push
 * the model toward the questions only a tool can answer.
 *
 * Tools are pure reads over the computed bundle. They cannot fail in a way
 * that requires a retry and they cannot reach the network, so a tool call is
 * never the reason a response goes wrong.
 */

import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaToolRunnerParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

import {
  comparePeriods,
  getMetricSeries,
  getSleepBreakdown,
  getWorkouts,
  METRIC_META,
} from "@health/core";
import type { MetricKey, MetricsBundle } from "@health/core";

const METRIC_KEYS = Object.keys(METRIC_META) as [MetricKey, ...MetricKey[]];

const METRIC = z
  .enum(METRIC_KEYS)
  .describe(
    "The metric to read, using its key from the reference catalogue (for example `steps`, `restingHeartRate`, `sleepDurationMin`).",
  );

const DAYS = z
  .number()
  .int()
  .min(7)
  .max(90)
  .describe("Length of the window in days. Clamped to 7–90; defaults to the tool's own default.");

/** Tool results are JSON text; the model reads structure better than prose. */
const json = (value: unknown): string => {
  return JSON.stringify(value, null, 1);
};

/** What `toolRunner` accepts for `tools`, taken from the SDK rather than restated. */
type RunnerTool = NonNullable<BetaToolRunnerParams["tools"]>[number];

/**
 * Drop the `type: "custom"` tag that `betaZodTool` puts on every tool it builds.
 *
 * The Messages API does not accept that variant. A client tool is the one with
 * no `type` at all — only server tools carry one, which is why the rejection
 * message helpfully suggests `web_search_20250305`. Left in place, the tag
 * fails deserialisation and the whole request 400s before the model sees it.
 *
 * Nothing is lost by removing it. The tool runner dispatches on `name`, `run`
 * and `parse`, never on `type`.
 *
 * The input stays `unknown` on purpose. `betaZodTool` declares its result as the
 * SDK's client-tool union — memory, bash, text-editor and the rest — even though
 * it only ever builds a plain one, and that union does not survive `Omit`. The
 * type safety that matters is upstream of here: each tool's `run` is checked
 * against its own Zod schema where the tool is defined.
 */
const wireTools = (tools: readonly unknown[]): RunnerTool[] =>
  tools.map((tool) => {
    const { type: _discarded, ...rest } = tool as { type?: unknown };
    return rest as RunnerTool;
  });

export const createTools = (bundle: MetricsBundle) => {
  const getSeries = betaZodTool({
    name: "get_metric_series",
    description: `Read one metric day by day over a window, with the window's average, low and high, and any life events that fall inside it.

Use this when the question is about the *shape* of the data over time — "how has my step count changed", "what did the week of the 3rd look like", "was there a dip and when". Do not use it to report a current average: every average for every metric is already in the reference catalogue, and calling this for one only adds delay.

Days with no recorded value are returned as gaps, not as zeroes. Describe them as gaps.`,
    inputSchema: z.object({ metric: METRIC, days: DAYS.default(30) }),
    run: async ({ metric, days }) => json(getMetricSeries(bundle, metric, days)),
  });

  const compare = betaZodTool({
    name: "compare_periods",
    description: `Compare one metric's average over the last N days against the N days immediately before it, and say whether the change counts as an improvement.

The verdict is already resolved against the metric's good direction, so trust it rather than deciding yourself whether a rise is good — a rising resting heart rate and rising step count point opposite ways.

Use this for "is X getting better", "how does this month compare to last". Do not use it for a window longer than 90 days, and do not use it when the reference catalogue already contains the comparison you need.`,
    inputSchema: z.object({ metric: METRIC, days: DAYS.default(7) }),
    run: async ({ metric, days }) => json(comparePeriods(bundle, metric, days)),
  });

  const sleep = betaZodTool({
    name: "get_sleep_breakdown",
    description: `Night-by-night sleep detail: time asleep, efficiency, minutes in each stage, bedtime and wake time, plus the average bedtime and how much it varies.

Use this for anything about sleep quality, timing or consistency — "why is my sleep score low", "am I going to bed later than I used to". For the single sleep average, the catalogue is enough.

Nights where the watch was not worn are absent. Do not describe an absent night as a bad night's sleep.`,
    inputSchema: z.object({ days: DAYS.default(14) }),
    run: async ({ days }) => json(getSleepBreakdown(bundle, days)),
  });

  const workouts = betaZodTool({
    name: "get_workouts",
    description: `List the recorded training sessions in a window — duration, distance, average and maximum heart rate, minutes in each heart-rate zone, and perceived effort — with totals and a breakdown by activity type.

Use this for training questions the daily metrics cannot answer: how many sessions, how far, how hard, whether intensity has shifted. This is the only source for per-session detail.

Returns an empty list when nothing was recorded in the window. That is a real answer, not an error — say the window was empty rather than reaching for a different number.`,
    inputSchema: z.object({
      days: DAYS.default(14),
      type: z
        .enum(["run", "walk", "strength", "cycle", "yoga", "swim"])
        .optional()
        .describe("Restrict to one activity type. Omit for all types."),
    }),
    run: async ({ days, type }) => json(getWorkouts(bundle, days, type)),
  });

  return wireTools([getSeries, compare, sleep, workouts]);
};
