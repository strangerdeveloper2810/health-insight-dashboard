/**
 * How a readiness score is presented.
 *
 * The thresholds live here rather than inside the components because they are
 * the same judgement in three places — the dial's colour, each component bar's
 * colour, and the arrow beside every input — and a score that reads "good" in
 * the ring but "fair" in the bar below it is worse than either alone.
 */

import type { ReadinessComponent, ReadinessScore } from "@health/core";

import type { Tone } from "@/ui/primitives";

export const BAND_TONE: Record<ReadinessScore["band"], Tone> = {
  excellent: "positive",
  good: "accent",
  fair: "watch",
  poor: "alert",
};

export const BAND_LABEL: Record<ReadinessScore["band"], string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

/**
 * The tone for a 0–100 sub-score.
 *
 * Note the ladder is `accent` rather than `brand` in the middle: these are
 * measurements, and brand is reserved for the product asking the reader to do
 * something. A bar quietly reporting 72 is not a call to action.
 */
export const componentTone = (score: number): Tone => {
  if (score >= 80) return "positive";
  if (score >= 60) return "accent";
  if (score >= 40) return "watch";
  return "alert";
};

/**
 * One input's effect on its component.
 *
 * The arrow is decoration; the `sr` string is the actual content, because a
 * screen reader announcing "black up-pointing triangle 7.4h" is noise.
 */
export const CONTRIBUTION: Record<
  ReadinessComponent["inputs"][number]["contribution"],
  { tone: Tone; glyph: string; sr: string }
> = {
  up: { tone: "positive", glyph: "▲", sr: "pushing the score up" },
  down: { tone: "alert", glyph: "▼", sr: "pulling the score down" },
  flat: { tone: "muted", glyph: "—", sr: "neutral" },
};
