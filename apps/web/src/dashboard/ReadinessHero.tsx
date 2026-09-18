/**
 * The first thing on the page: one number, what it means, and what produced it.
 *
 * The order is the point. A score with no explanation is a horoscope — the
 * user cannot tell whether to act on it or ignore it. So the ring is followed
 * immediately by the three components that made it, each with a sentence
 * naming the input that moved it and the raw figures underneath. Someone who
 * disagrees with the score can see exactly which number they disagree with.
 */

import type { ReadinessComponent, ReadinessScore } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectPersona } from "@/features/selectors";
import { Bar, Card, Ring, toneText } from "@/ui/primitives";
import type { Tone } from "@/ui/primitives";

const BAND_TONE: Record<ReadinessScore["band"], Tone> = {
  excellent: "positive",
  good: "brand",
  fair: "watch",
  poor: "alert",
};

const BAND_LABEL: Record<ReadinessScore["band"], string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const CONTRIBUTION: Record<
  ReadinessComponent["inputs"][number]["contribution"],
  { tone: Tone; glyph: string; sr: string }
> = {
  up: { tone: "positive", glyph: "▲", sr: "pushing the score up" },
  down: { tone: "alert", glyph: "▼", sr: "pulling the score down" },
  flat: { tone: "muted", glyph: "—", sr: "neutral" },
};

function ComponentRow({ component }: { component: ReadinessComponent }) {
  const tone: Tone =
    component.score >= 80 ? "positive" : component.score >= 60 ? "brand" : component.score >= 40 ? "watch" : "alert";

  return (
    <li className="rounded-lg border border-line bg-raised px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {component.label}
        </span>
        <span className="text-sm font-semibold tabular-nums text-ink">
          {component.score}
          <span className="ml-1 text-[11px] font-normal text-faint">
            {Math.round(component.weight * 100)}% of score
          </span>
        </span>
      </div>

      <Bar value={component.score} tone={tone} label={`${component.label} score`} className="mt-2" />

      <p className="mt-2 text-xs leading-relaxed text-muted">{component.explanation}</p>

      {component.inputs.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {component.inputs.map((input) => {
            const mark = CONTRIBUTION[input.contribution];
            return (
              <li key={input.label} className="flex items-center gap-1.5 text-[11px] text-faint">
                <span className={toneText(mark.tone)} aria-hidden>
                  {mark.glyph}
                </span>
                <span className="sr-only">{mark.sr}</span>
                <span>{input.label}</span>
                <span className="font-medium text-muted">{input.value}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export function ReadinessHero({ readiness }: { readiness: ReadinessScore }) {
  const persona = useAppSelector(selectPersona);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:gap-7 sm:p-6">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Ring value={readiness.score} tone={BAND_TONE[readiness.band]}>
            <div>
              <div className={`text-4xl font-semibold leading-none ${toneText(BAND_TONE[readiness.band])}`}>
                {readiness.score}
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-faint">
                {BAND_LABEL[readiness.band]}
              </div>
            </div>
          </Ring>
          <p className="text-[11px] text-faint">Readiness today</p>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-snug tracking-tight text-ink sm:text-xl">
            {readiness.headline}
          </h1>

          {persona ? (
            <p className="mt-1.5 text-xs text-muted">
              {persona.name}, {persona.age} · {persona.occupation} · {persona.location}
              {persona.primaryGoal ? ` · ${persona.primaryGoal.label}` : ""}
            </p>
          ) : null}

          {readiness.components.length > 0 ? (
            <ul className="mt-4 grid gap-2.5">
              {readiness.components.map((component) => (
                <ComponentRow key={component.id} component={component} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer className="border-t border-line bg-raised px-5 py-2.5 text-[11px] text-faint sm:px-6">
        {/* Say what the score is not. A wellness heuristic presented as a
            clinical measurement is the single most harmful thing this screen
            could do. */}
        A wellness heuristic from your own sleep, recovery and training load — not a
        clinical assessment. It is not a diagnosis and does not replace advice from your
        clinician.
      </footer>
    </Card>
  );
}
