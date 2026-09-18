/**
 * How a readiness score is presented. The thresholds live here because the dial,
 * the bars and the arrows would otherwise disagree about what "good" means.
 */

import type { ReadinessComponent, ReadinessScore } from "@health/core";

import type { Tone } from "@/shared/ui/primitives";

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
 * The tone for a 0–100 sub-score. The middle rung is `accent`, not `brand`:
 * these are measurements, and brand is reserved for asking the reader to act.
 */
export const componentTone = (score: number): Tone => {
  if (score >= 80) return "positive";
  if (score >= 60) return "accent";
  if (score >= 40) return "watch";
  return "alert";
};

/**
 * One input's effect on its component. The arrow is decoration; `sr` is the
 * content, because a screen reader announcing a triangle glyph is noise.
 */
export const CONTRIBUTION: Record<
  ReadinessComponent["inputs"][number]["contribution"],
  { tone: Tone; glyph: string; sr: string }
> = {
  up: { tone: "positive", glyph: "▲", sr: "pushing the score up" },
  down: { tone: "alert", glyph: "▼", sr: "pulling the score down" },
  flat: { tone: "muted", glyph: "—", sr: "neutral" },
};
