/**
 * The dashboard payload.
 *
 * Everything the browser renders is computed here, once, at boot. The client
 * is a renderer: it holds no analytics of its own, so there is exactly one
 * implementation of "what is the seven-day average" in the running system.
 *
 * The reference index travels with the payload because the browser needs it
 * to render citations. When the assistant writes {{restingHeartRate.avg7d}},
 * the client looks the token up in this list and prints the value — the same
 * value, from the same computation, that the trend chart is drawing.
 */

import { buildDashboard, createDefaultDataset, refCatalogue } from "@health/core";
import type { DashboardModel, DashboardPayload } from "@health/core";

import type { Config } from "./config";
import { publicConfig } from "./config";

export interface DashboardBundle {
  model: DashboardModel;
  payload: DashboardPayload;
}

export function buildPayload(config: Config): DashboardBundle {
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
}

/**
 * Memoised for the running server. The dataset is seeded and deterministic,
 * so recomputing it per request would only add latency and a chance of the
 * dashboard and the assistant drifting onto different numbers.
 *
 * Keyed on the two fields that actually change the data rather than held in a
 * single slot: a long-lived process that is restarted with a different seed
 * should not keep serving the previous person.
 */
let cached: { key: string; bundle: DashboardBundle } | null = null;

export function getDashboard(config: Config): DashboardBundle {
  const key = `${config.datasetSeed}:${config.datasetDays}`;
  if (cached?.key !== key) {
    cached = { key, bundle: buildPayload(config) };
  }
  return cached.bundle;
}
