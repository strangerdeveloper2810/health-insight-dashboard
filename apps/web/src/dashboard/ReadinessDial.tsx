import type { ReadinessScore } from "@health/core";

import { useCountUp } from "@/lib/useCountUp";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Ring, toneText } from "@/ui/primitives";
import { BAND_LABEL, BAND_TONE } from "./readiness";

/**
 * The verdict.
 *
 * The score animates up from zero rather than appearing, which is the one
 * piece of motion on this page doing real work: it draws the eye to the number
 * first, before the evidence, in the order the reader is meant to take it in.
 */
export const ReadinessDial = ({ readiness }: { readiness: ReadinessScore }) => {
  // The dial's geometry is arithmetic on its radius, so unlike the rest of the
  // page it cannot be resized by a class — it has to be told.
  const wide = useMediaQuery("(min-width: 640px)");
  const score = useCountUp(readiness.score);
  const tone = BAND_TONE[readiness.band];

  return (
    <div className="flex items-center gap-4 sm:block">
      <Ring value={readiness.score} size={wide ? 168 : 118} stroke={wide ? 15 : 11} tone={tone}>
        <div>
          {/* Serif, and dark: the ring already carries the colour, so the
              number's job is weight rather than hue. Every other figure on this
              page is sans — this is the one that is a judgement rather than a
              measurement. */}
          <div className="font-display text-[2.7rem] font-semibold leading-none text-ink tabular-nums sm:text-[3.1rem]">
            {Math.round(score)}
          </div>
          <div className={`mt-1.5 text-[0.72rem] font-semibold ${toneText(tone)}`}>
            {BAND_LABEL[readiness.band]}
          </div>
        </div>
      </Ring>
      <p className="text-[0.78rem] text-faint sm:mt-3 sm:text-center">Readiness today</p>
    </div>
  );
};
