/**
 * The dashboard payload, computed once at boot. The client is a renderer and
 * holds no analytics of its own, so there is exactly one implementation of
 * "what is the seven-day average" in the running system. The reference index
 * travels with it so the browser can resolve citation tokens against the same
 * values the charts are drawing.
 */

import { buildDashboard, createDefaultDataset, refCatalogue } from "@health/core";
import type { DashboardModel, DashboardPayload } from "@health/core";

import type { Config } from "../config";
import { publicConfig } from "../config";

export interface DashboardBundle {
  model: DashboardModel;
  payload: DashboardPayload;
}

export const buildPayload = (config: Config): DashboardBundle => {
  const dataset = createDefaultDataset({
    seed: config.datasetSeed,
    days: config.datasetDays,
  });
  const model = buildDashboard(dataset);

  const summaries = Object.fromEntries(
    Object.entries(model.bundle.summaries).map(([key, summary]) => {
      const { series: _series, ...rest } = summary;
      return [key, rest];
    }),
  ) as DashboardPayload["summaries"];

  return {
    model,
    payload: {
      dataset,
      readiness: model.readiness,
      insights: model.insights,
      series: model.bundle.series,
      summaries,
      derived: model.bundle.derived,
      refs: refCatalogue(model.index),
      config: publicConfig(config),
    },
  };
};

/**
 * Memoised: the dataset is deterministic, so recomputing it per request would
 * only add latency. Keyed on the two fields that change the data rather than
 * held in a single slot, so a process restarted with a different seed does not
 * keep serving the previous person.
 */
let cached: { key: string; bundle: DashboardBundle } | null = null;

export const getDashboard = (config: Config): DashboardBundle => {
  const key = `${config.datasetSeed}:${config.datasetDays}`;
  if (cached?.key !== key) {
    cached = { key, bundle: buildPayload(config) };
  }
  return cached.bundle;
};
