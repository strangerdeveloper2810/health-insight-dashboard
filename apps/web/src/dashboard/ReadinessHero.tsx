/**
 * The first thing on the page: one number, what it means, and what to do
 * about it.
 *
 * The order is the point, and it is a reading order rather than a data order.
 * A score with no explanation is a horoscope — the reader cannot tell whether
 * to act on it or ignore it. But a score followed by three panels of evidence
 * is a research task, and the answer to "so what should I do?" ends up third
 * in a grid, at the same weight as everything else.
 *
 * So the hero is: the verdict, the one action that follows from it, and then
 * the three components that produced it — each with a sentence naming the
 * input that moved it and the raw figures underneath. Someone who disagrees
 * with the score can see exactly which number they disagree with, and someone
 * who agrees knows what to do before they scroll.
 *
 * This file is composition only. The dial, the columns and the thresholds each
 * live in their own module.
 */

import type { CSSProperties } from "react";

import type { ReadinessScore } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectDataset, selectPersona, selectTopInsight } from "@/features/selectors";
import { formatRange } from "@/lib/format";
import { Card } from "@/ui/primitives";
import { InsightCard } from "./InsightCard";
import { ReadinessComponentColumn } from "./ReadinessComponentColumn";
import { ReadinessDial } from "./ReadinessDial";

export const ReadinessHero = ({ readiness }: { readiness: ReadinessScore }) => {
  const persona = useAppSelector(selectPersona);
  const dataset = useAppSelector(selectDataset);
  const topInsight = useAppSelector(selectTopInsight);

  return (
    <div className="stagger" style={{ "--i": 0 } as CSSProperties}>
      <Card className="overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-8 sm:p-8">
          <ReadinessDial readiness={readiness} />

          <div className="min-w-0">
            {dataset ? (
              <p className="text-[0.78rem] text-faint">
                {formatRange(dataset.range.start, dataset.range.end)} · {dataset.range.days} days
              </p>
            ) : null}

            <h1 className="mt-2 font-display text-[1.7rem] font-semibold leading-[1.14] tracking-[-0.02em] text-balance text-ink sm:text-[2.15rem]">
              {readiness.headline}
            </h1>

            {persona ? (
              <p className="mt-2.5 text-[0.85rem] text-muted">
                {persona.name}, {persona.age} · {persona.occupation} · {persona.location}
                {persona.primaryGoal ? ` · ${persona.primaryGoal.label}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        {/* The answer the reader came for. Pulled out of the feed below and
            given the whole width, because it is the one thing on this page
            that is a decision rather than a description. */}
        {topInsight ? (
          <div className="px-5 pb-6 sm:px-8">
            <InsightCard insight={topInsight} variant="focus" />
          </div>
        ) : null}

        {readiness.components.length > 0 ? (
          <ul className="grid gap-6 border-t border-line px-5 py-6 sm:grid-cols-3 sm:px-8">
            {readiness.components.map((component) => (
              <ReadinessComponentColumn key={component.id} component={component} />
            ))}
          </ul>
        ) : null}

        <footer className="border-t border-line px-5 py-3 text-[0.72rem] leading-relaxed text-faint sm:px-8">
          {/* Say what the score is not. A wellness heuristic presented as a
              clinical measurement is the single most harmful thing this screen
              could do. */}
          A wellness heuristic from your own sleep, recovery and training load — not a clinical
          assessment. It is not a diagnosis and does not replace advice from your clinician.
        </footer>
      </Card>
    </div>
  );
};
