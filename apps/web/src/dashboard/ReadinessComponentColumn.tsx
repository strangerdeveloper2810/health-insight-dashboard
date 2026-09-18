import type { ReadinessComponent } from "@health/core";

import { Bar, toneText } from "@/ui/primitives";
import { CONTRIBUTION, componentTone } from "./readiness";

/**
 * One component of the score, and the inputs that produced it. The inputs are
 * the point: a reader who disagrees with a 72 can only argue with the resting
 * heart rate underneath it.
 */
export const ReadinessComponentColumn = ({ component }: { component: ReadinessComponent }) => {
  const tone = componentTone(component.score);

  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.85rem] font-semibold tracking-tight text-ink">
          {component.label}
        </span>
        <span className="font-display text-[1.4rem] font-semibold leading-none text-ink tabular-nums">
          {component.score}
        </span>
      </div>

      <Bar
        value={component.score}
        tone={tone}
        label={`${component.label} score`}
        className="mt-2.5"
      />
      <p className="mt-1.5 text-[0.72rem] text-faint">
        {Math.round(component.weight * 100)}% of today&rsquo;s score
      </p>

      <p className="mt-2.5 text-[0.82rem] leading-relaxed text-muted">{component.explanation}</p>

      {component.inputs.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {component.inputs.map((input) => {
            const mark = CONTRIBUTION[input.contribution];
            return (
              <li
                key={input.label}
                className="flex items-baseline justify-between gap-2 text-[0.76rem]"
              >
                <span className="min-w-0 truncate text-faint">{input.label}</span>
                <span className="flex shrink-0 items-center gap-1.5 font-medium text-muted">
                  <span className={toneText(mark.tone)} aria-hidden>
                    {mark.glyph}
                  </span>
                  <span className="sr-only">{mark.sr}</span>
                  {input.value}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
};
