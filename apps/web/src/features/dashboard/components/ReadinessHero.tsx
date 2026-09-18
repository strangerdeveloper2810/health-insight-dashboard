/**
 * The first thing on the page: the verdict, the action that follows from it, then
 * the three components that produced it — a reading order, not a data order.
 * Composition only; the dial, columns and thresholds have their own modules.
 */

import type { CSSProperties } from "react";

import type { ReadinessScore } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectDataset, selectPersona, selectTopInsight } from "@/features/selectors";
import { formatRange } from "@/shared/lib/format";
import { Card } from "@/shared/ui/primitives";
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
          {/* Say what the score is not: a wellness heuristic read as a clinical
              measurement is the harm this line exists to prevent. */}
          A wellness heuristic from your own sleep, recovery and training load — not a clinical
          assessment. It is not a diagnosis and does not replace advice from your clinician.
        </footer>
      </Card>
    </div>
  );
};
