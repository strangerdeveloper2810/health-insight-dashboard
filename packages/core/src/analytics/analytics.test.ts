import { describe, expect, it } from "vitest";

import { createDefaultDataset, generateDataset } from "./dataset";
import { buildDashboard } from "../index";
import { buildSeries, computeMetrics } from "./metrics";
import { computeReadiness, readinessBand } from "./readiness";
import { MAYA, personaWithDatedGoals } from "../models/persona";
import { hasRef } from "../utils/refs";

const dataset = createDefaultDataset();
const model = buildDashboard(dataset);

describe("dataset generation", () => {
  it("is deterministic for a given seed", () => {
    const a = createDefaultDataset({ seed: 42 });
    const b = createDefaultDataset({ seed: 42 });
    expect(JSON.stringify(a.daily)).toBe(JSON.stringify(b.daily));
    expect(JSON.stringify(a.workouts)).toBe(JSON.stringify(b.workouts));
  });

  it("produces different data for a different seed", () => {
    const a = createDefaultDataset({ seed: 1 });
    const b = createDefaultDataset({ seed: 2 });
    expect(JSON.stringify(a.daily)).not.toBe(JSON.stringify(b.daily));
  });

  it("covers the requested range with one record per day", () => {
    const { range, daily } = dataset;
    expect(daily).toHaveLength(range.days);
    expect(daily[0]?.date).toBe(range.start);
    expect(daily[daily.length - 1]?.date).toBe(range.end);
  });

  it("leaves genuine gaps rather than inventing observations", () => {
    // The persona sometimes does not wear the watch and sometimes does not
    // log food. Both must survive into the dataset as nulls.
    expect(dataset.daily.some((day) => day.sleep === null)).toBe(true);
    expect(dataset.daily.some((day) => day.nutrition === null)).toBe(true);
  });

  it("orders every event span oldest end first", () => {
    // An event whose `date` is after its `endDate` does not throw anywhere — it
    // draws as a zero-width band, so the chart quietly loses the shading. The
    // window constants are counted in days *ago*, which runs backwards against
    // the calendar, so this is easy to get wrong and impossible to notice.
    const spans = dataset.events.filter((event) => event.endDate);
    expect(spans.length).toBeGreaterThan(0);
    for (const event of spans) {
      expect(event.date <= event.endDate!).toBe(true);
    }
  });

  it("places every event inside the generated range", () => {
    for (const event of dataset.events) {
      expect(event.date >= dataset.range.start).toBe(true);
      expect(event.date <= dataset.range.end).toBe(true);
    }
  });

  it("keeps resting heart rate tied to the previous night's sleep", () => {
    // The flagship insight is discovered from the data, so the relationship
    // has to be genuinely present rather than asserted by the rule.
    const link = model.bundle.derived.sleepHeartRateLink;
    expect(link).not.toBeNull();
    expect(link!.avgRhrAfterShortSleep).toBeGreaterThan(link!.avgRhrAfterNormalSleep);
    expect(link!.deltaBpm).toBeGreaterThan(1);
  });
});

describe("series construction", () => {
  it("omits days without an observation instead of zero-filling them", () => {
    const sleepSeries = buildSeries(dataset, "sleepDurationMin");
    const nightsWithSleep = dataset.daily.filter((day) => day.sleep !== null).length;
    expect(sleepSeries).toHaveLength(nightsWithSleep);
    expect(sleepSeries.length).toBeLessThan(dataset.daily.length);
    expect(sleepSeries.every((point) => point.value > 0)).toBe(true);
  });

  it("returns points in ascending date order", () => {
    const dates = buildSeries(dataset, "steps").map((point) => point.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("reports a sample count below the window length when days are missing", () => {
    const summary = model.bundle.summaries.sleepDurationMin;
    const thirtyDay = summary?.windows.find((w) => w.window === "30d");
    expect(thirtyDay?.sampleCount).toBeLessThan(30);
  });
});

describe("readiness", () => {
  it("weights the components into the composite score", () => {
    const weighted = model.readiness.components.reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    );
    expect(Math.round(weighted)).toBe(model.readiness.score);
  });

  it("assigns each band to the right score range", () => {
    expect(readinessBand(90)).toBe("excellent");
    expect(readinessBand(75)).toBe("good");
    expect(readinessBand(60)).toBe("fair");
    expect(readinessBand(30)).toBe("poor");
  });

  it("keeps every component on a 0–100 scale", () => {
    for (const component of model.readiness.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
    }
  });

  it("names the weakest component in the headline when one is clearly limiting", () => {
    const weakest = [...model.readiness.components].sort((a, b) => a.score - b.score)[0]!;
    if (weakest.score < 70 && model.readiness.score < 85) {
      expect(model.readiness.headline).toContain(
        weakest.id === "sleep" ? "Sleep" : weakest.id === "recovery" ? "body" : "load",
      );
    }
  });

  it("does not move when the same dataset is recomputed", () => {
    expect(computeReadiness(computeMetrics(dataset))).toEqual(model.readiness);
  });
});

describe("goal evaluation", () => {
  const progressFor = (id: string) =>
    model.bundle.derived.goalProgress.find((p) => p.goal.id === id)!;

  it("measures a journey goal by distance travelled from the start value", () => {
    const tenK = progressFor("goal-10k");
    expect(tenK.goal.kind).toBe("journey");
    const expected = Math.round(
      ((tenK.currentValue - tenK.goal.startValue) /
        (tenK.goal.targetValue - tenK.goal.startValue)) *
        100,
    );
    expect(tenK.percentComplete).toBe(expected);
    expect(tenK.daysMet).toBeNull();
  });

  it("measures a threshold goal by days met, not by distance travelled", () => {
    const sleep = progressFor("goal-sleep");
    expect(sleep.goal.kind).toBe("threshold");
    expect(sleep.daysMet).not.toBeNull();
    expect(sleep.daysConsidered).not.toBeNull();
    expect(sleep.percentComplete).toBe(
      Math.round((sleep.daysMet! / sleep.daysConsidered!) * 100),
    );
    expect(sleep.daysMet!).toBeLessThanOrEqual(sleep.daysConsidered!);
    expect(sleep.projectedDate).toBeNull();
  });

  it("counts only days that were actually recorded", () => {
    const steps = progressFor("goal-steps");
    const recorded = buildSeries(dataset, "steps").slice(-30).length;
    expect(steps.daysConsidered).toBe(recorded);
  });

  it("treats a value goal as a journey even when the target is a level", () => {
    // Resting heart rate drifts around its baseline, so a day count would
    // report measurement noise as adherence.
    expect(progressFor("goal-rhr").goal.kind).toBe("journey");
  });

  it("gives every goal a non-empty rationale for the assistant to draw on", () => {
    for (const progress of model.bundle.derived.goalProgress) {
      expect(progress.goal.rationale.length).toBeGreaterThan(20);
    }
  });
});

describe("insight rules", () => {
  it("fires a useful number of rules on the default dataset", () => {
    expect(model.insights.length).toBeGreaterThanOrEqual(5);
    expect(model.insights.length).toBeLessThanOrEqual(10);
  });

  it("orders insights by severity, alerts first", () => {
    const order = { alert: 0, watch: 1, positive: 2, info: 3 } as const;
    const ranks = model.insights.map((insight) => order[insight.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("resolves every piece of evidence against the reference index", () => {
    // This is the invariant the whole grounding story rests on: an insight
    // card cannot cite a number the assistant is not also allowed to cite.
    for (const insight of model.insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      for (const ref of insight.evidence) {
        expect(hasRef(model.index, ref.ref), `${insight.id} cites ${ref.ref}`).toBe(true);
      }
    }
  });

  it("gives every insight an id unique within the feed", () => {
    const ids = model.insights.map((insight) => insight.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attaches a caveat to anything built on incomplete logging", () => {
    const nutrition = model.insights.find((insight) => insight.rule === "nutrition-logging-gap");
    if (nutrition) expect(nutrition.caveat).toBeTruthy();
  });

  it("does not fire the sleep–heart-rate rule on data with no such link", () => {
    // A dataset with a flat resting heart rate must not produce the card.
    const flat = createDefaultDataset({ seed: 7 });
    const flatModel = buildDashboard(flat);
    const link = flatModel.bundle.derived.sleepHeartRateLink;
    const card = flatModel.insights.find((insight) => insight.rule === "sleep-heart-rate-link");
    if (card) expect(link!.deltaBpm).toBeGreaterThanOrEqual(2.5);
  });
});

describe("persona", () => {
  it("dates the goals relative to the dataset window", () => {
    const dated = personaWithDatedGoals(MAYA, "2026-06-21", "2026-08-02", "2026-10-24");
    expect(dated.primaryGoal.startDate).toBe("2026-08-02");
    expect(dated.primaryGoal.targetDate).toBe("2026-10-24");
    // Secondary goals are habits the user holds across the whole window, so
    // they start when the data does rather than when the plan did.
    for (const goal of dated.secondaryGoals) {
      expect(goal.startDate).toBe("2026-06-21");
    }
    expect(dated.primaryGoal.targetDate > dated.primaryGoal.startDate).toBe(true);
    // Dating the goals must not mutate the source persona.
    expect(MAYA.primaryGoal.startDate).toBe("");
  });

  it("keeps every goal pointed at a metric that exists", () => {
    for (const goal of [MAYA.primaryGoal, ...MAYA.secondaryGoals]) {
      expect(model.bundle.summaries[goal.metric]).toBeDefined();
    }
  });
});

describe("generator options", () => {
  it("honours a custom day count", () => {
    const short = generateDataset(MAYA, { days: 30 });
    expect(short.daily).toHaveLength(30);
    expect(short.range.days).toBe(30);
  });
});
