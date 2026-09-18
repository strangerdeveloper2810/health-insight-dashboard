import { describe, expect, it } from "vitest";

import { createDefaultDataset } from "./dataset";
import { buildDashboard } from "./index";
import { buildDataSnapshot, buildSystemPrompt, SUGGESTED_QUESTIONS } from "./llm/context";
import {
  dropRepeatedUnits,
  renderGrounded,
  segmentGrounded,
  stripRefTokens,
  validateCitations,
} from "./llm/grounding";
import {
  comparePeriods,
  getMetricSeries,
  getSleepBreakdown,
  getWorkouts,
} from "./llm/queries";

const dataset = createDefaultDataset();
const model = buildDashboard(dataset);
const { index } = model;

describe("grounding", () => {
  it("resolves a citation to the value in the index", () => {
    const ref = index.refs.get("restingHeartRate.avg7d")!;
    const segments = segmentGrounded("Your RHR is {{restingHeartRate.avg7d}}.", index);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({ kind: "ref", ref: { value: ref.value } });
  });

  it("reports a clean bill of health when every citation resolves", () => {
    const report = validateCitations(
      "Sleep {{sleepDurationMin.avg7d}} and steps {{steps.avg7d}}.",
      index,
    );
    expect(report.grounded).toBe(true);
    expect(report.unknown).toEqual([]);
    expect(report.cited).toEqual(["sleepDurationMin.avg7d", "steps.avg7d"]);
  });

  it("catches an invented reference rather than letting it through", () => {
    const report = validateCitations(
      "Your blood glucose is {{bloodGlucose.avg7d}} and sleep is {{sleepDurationMin.avg7d}}.",
      index,
    );
    expect(report.grounded).toBe(false);
    expect(report.unknown).toEqual(["bloodGlucose.avg7d"]);
  });

  it("marks unknown references visibly instead of dropping them silently", () => {
    // Silently deleting the token would leave a sentence that reads as if the
    // model simply chose not to give a figure. The gap has to be visible.
    const rendered = renderGrounded("Glucose {{made.up.ref}}.", index);
    expect(rendered).toContain("unverified");
    expect(rendered).toContain("made.up.ref");
  });

  it("does not leak regex state between calls", () => {
    // A module-level /g regex would carry lastIndex and silently skip
    // citations on the second call — the exact failure this module prevents.
    const text = "{{steps.avg7d}} then {{sleepDurationMin.avg7d}}";
    expect(validateCitations(text, index).cited).toHaveLength(2);
    expect(validateCitations(text, index).cited).toHaveLength(2);
    expect(segmentGrounded(text, index).filter((s) => s.kind === "ref")).toHaveLength(2);
  });

  it("de-duplicates repeated citations in the report", () => {
    const report = validateCitations("{{steps.avg7d}} and again {{steps.avg7d}}", index);
    expect(report.cited).toEqual(["steps.avg7d"]);
  });

  it("strips tokens for previews without leaving double spaces", () => {
    expect(stripRefTokens("Sleep is {{sleepDurationMin.avg7d}} tonight.")).toBe(
      "Sleep is tonight.",
    );
  });

  it("round-trips prose that contains no citations at all", () => {
    const segments = segmentGrounded("No numbers here.", index);
    expect(segments).toEqual([{ kind: "text", text: "No numbers here." }]);
  });

  describe("a unit written after a citation", () => {
    /** Ground the markdown and flatten it, which is what the user reads. */
    const read = (input: string) => renderGrounded(input, index);

    it("is dropped, because the citation already prints it", () => {
      expect(read("Your RHR is averaging {{restingHeartRate.avg7d}} bpm, which")).toMatch(
        /averaging \d+ bpm, which/,
      );
    });

    it("is dropped when emphasis sits between the token and the unit", () => {
      // The commonest phrasing of all, and the one a pass over parsed
      // markdown nodes would miss: `**` separates the two.
      const rendered = read("Your RHR is averaging **{{restingHeartRate.avg7d}}** bpm, which");
      expect(rendered).toMatch(/averaging \*\*\d+ bpm\*\*, which/);
      expect(rendered).not.toMatch(/bpm bpm/);
    });

    it("is dropped for a unit written without a space", () => {
      expect(read("HRV is {{hrvMs.avg7d}}ms today")).toMatch(/HRV is \d+ ms today/);
    });

    it("is dropped for a percentage, which renders attached", () => {
      expect(read("Blood oxygen {{spo2.avg7d}}% overnight")).toMatch(/Blood oxygen \d+% overnight/);
    });

    it("is kept when it is a different unit from the citation's", () => {
      // The "ms" belongs to the second citation, not the first.
      expect(read("{{restingHeartRate.avg7d}} bpm and {{hrvMs.avg7d}} ms")).toMatch(
        /\d+ bpm and \d+ ms/,
      );
    });

    it("is kept when it is the start of a longer word", () => {
      // Only the bare unit is a duplicate: "g" is repeated, "grams" is not.
      expect(read("You averaged {{proteinG.avg7d}} g of protein")).toMatch(/\d+ g of protein/);
    });

    it("is left alone for duration refs, which print no unit at all", () => {
      // "7h 30m" already carries its own units, so a following "min" is the
      // model's own wording rather than a duplicate and must survive.
      expect(read("You slept {{sleepDurationMin.avg7d}} min in total")).toMatch(
        /You slept \d+h \d+m min in total/,
      );
    });

    it("leaves a bolded unit with balanced emphasis markers", () => {
      const rendered = read("Your RHR is **{{restingHeartRate.avg7d}}bpm** today");
      expect(rendered).not.toMatch(/\*{4}/);
      expect(rendered).toMatch(/Your RHR is \*\*\d+ bpm\*\* today/);
    });

    it("does not disturb text when the model wrote no unit", () => {
      const input = "Your RHR is {{restingHeartRate.avg7d}} and holding steady.";
      expect(dropRepeatedUnits(input, index)).toBe(input);
    });
  });
});

describe("reference index", () => {
  it("indexes every metric's rolling windows", () => {
    for (const key of ["steps", "sleepDurationMin", "restingHeartRate", "hrvMs"] as const) {
      expect(index.refs.has(`${key}.avg7d`)).toBe(true);
      expect(index.refs.has(`${key}.avg30d`)).toBe(true);
      expect(index.refs.has(`${key}.avg90d`)).toBe(true);
    }
  });

  it("indexes the readiness score and its components", () => {
    expect(index.refs.get("readiness.score")?.value).toBe(model.readiness.score);
    for (const component of model.readiness.components) {
      expect(index.refs.get(`readiness.${component.id}`)?.value).toBe(component.score);
    }
  });

  it("indexes goal progress, including the hit rate for habit goals", () => {
    expect(index.refs.has("goal.goal-10k.current")).toBe(true);
    expect(index.refs.has("goal.goal-sleep.daysMet")).toBe(true);
    // A journey goal has no day count to report.
    expect(index.refs.has("goal.goal-10k.daysMet")).toBe(false);
  });

  it("stores one entry per reference id", () => {
    const ids = [...index.refs.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("prompt construction", () => {
  const system = buildSystemPrompt(dataset.persona);
  const snapshot = buildDataSnapshot({
    bundle: model.bundle,
    readiness: model.readiness,
    insights: model.insights,
    index,
  });

  it("tells the model how to cite and what it may not do", () => {
    expect(system).toContain("{{");
    expect(system).toMatch(/never type a health figure/i);
    expect(system).toMatch(/do not diagnose/i);
  });

  it("names the person rather than addressing a generic user", () => {
    expect(system).toContain(dataset.persona.name);
    expect(system).toContain(dataset.persona.clinicianGuidance);
  });

  it("lists every citable reference in the snapshot", () => {
    for (const ref of index.refs.values()) {
      expect(snapshot).toContain(ref.ref);
    }
  });

  it("carries the readiness breakdown so the hero number is explainable", () => {
    expect(snapshot).toContain(`Readiness: ${model.readiness.score}/100`);
    for (const component of model.readiness.components) {
      expect(snapshot).toContain(component.label);
    }
  });

  it("hands the model the dashboard's own conclusions", () => {
    for (const insight of model.insights) {
      expect(snapshot).toContain(insight.title);
    }
  });

  it("warns about incomplete logging before the numbers it affects", () => {
    expect(snapshot).toMatch(/Data quality/);
    expect(snapshot.indexOf("## Data quality")).toBeLessThan(
      snapshot.indexOf("## Reference catalogue"),
    );
  });

  it("marks the snapshot as data rather than instructions", () => {
    expect(snapshot).toMatch(/not instructions to you/i);
  });

  it("is byte-stable across rebuilds, so the prompt cache can hit", () => {
    const again = buildDataSnapshot({
      bundle: computeAgain(),
      readiness: model.readiness,
      insights: model.insights,
      index,
    });
    expect(again).toBe(snapshot);
  });

  it("offers opening questions the snapshot can actually answer", () => {
    expect(SUGGESTED_QUESTIONS.length).toBeGreaterThan(2);
    for (const question of SUGGESTED_QUESTIONS) {
      expect(question.endsWith("?")).toBe(true);
    }
  });
});

const computeAgain = () => {
  return buildDashboard(createDefaultDataset()).bundle;
};

describe("assistant queries", () => {
  it("returns a series with the days that were actually recorded", () => {
    const result = getMetricSeries(model.bundle, "sleepDurationMin", 30);
    expect(result.points.length).toBeLessThan(30);
    expect(result.observedDays).toBe(result.points.length);
    // The gap must be described, or the model reads it as a drop to zero.
    expect(result.note).toMatch(/no recorded value/i);
  });

  it("says nothing about gaps when there are none", () => {
    const result = getMetricSeries(model.bundle, "steps", 14);
    expect(result.points).toHaveLength(14);
    expect(result.note).toBeUndefined();
  });

  it("clamps an out-of-range window instead of failing", () => {
    expect(getMetricSeries(model.bundle, "steps", 5000).requestedDays).toBe(90);
    expect(getMetricSeries(model.bundle, "steps", 1).requestedDays).toBe(7);
  });

  it("resolves which direction counts as an improvement", () => {
    // More steps is better; a higher resting heart rate is not.
    expect(comparePeriods(model.bundle, "steps", 30).goodDirection).toBe("up");
    expect(comparePeriods(model.bundle, "restingHeartRate", 30).goodDirection).toBe("down");
  });

  it("returns null rather than NaN when a window has no data", () => {
    const empty = comparePeriods(model.bundle, "weightKg", 7);
    if (empty.current.average === null) {
      expect(empty.changePct).toBeNull();
      expect(empty.verdict).toBe("unknown");
    }
  });

  it("breaks the sleep window down by stage", () => {
    const sleep = getSleepBreakdown(model.bundle, 14);
    expect(sleep.nights.length).toBeGreaterThan(0);
    expect(sleep.averages.totalMin).toBeGreaterThan(0);
    expect(sleep.averages.bedtimeClock).toMatch(/^\d{2}:\d{2}$/);
    expect(sleep.debt14dMin).toBe(model.bundle.derived.sleepDebt14dMin);
  });

  it("filters workouts by type without losing the totals", () => {
    const all = getWorkouts(model.bundle, 90);
    const runs = getWorkouts(model.bundle, 90, "run");
    expect(runs.count).toBeLessThanOrEqual(all.count);
    expect(runs.workouts.every((w) => w.type === "run")).toBe(true);
    expect(runs.totalMinutes).toBeLessThanOrEqual(all.totalMinutes);
  });

  it("returns an empty result rather than throwing on a quiet window", () => {
    const result = getWorkouts(model.bundle, 7, "swim");
    expect(result.count).toBe(result.workouts.length);
  });
});
