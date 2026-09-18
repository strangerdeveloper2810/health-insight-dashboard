import type { ReadinessScore } from "@health/core";

import { useCountUp } from "@/shared/lib/useCountUp";
import { useMediaQuery } from "@/shared/lib/useMediaQuery";
import { Ring, toneText } from "@/shared/ui/primitives";
import { BAND_LABEL, BAND_TONE } from "./readiness";

/** The verdict: the ring, the score, and the band it falls in. */
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
          {/* Serif and ink, not the ring's tone: the ring already carries the
              colour, and this is the one figure here that is a judgement rather
              than a measurement. */}
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
