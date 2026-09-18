/**
 * The semantic colour vocabulary.
 *
 * Two of these carry meaning and are not interchangeable. `brand` is
 * terracotta: the product's own voice, used for anything it is asking the
 * reader to do. `accent` is petrol teal: a measurement. A progress bar is teal
 * because it reports; a button is terracotta because it asks.
 *
 * The class strings are written out in full rather than composed from a
 * template, because Tailwind scans source text — `bg-${tone}` would produce a
 * class that never appears in the stylesheet.
 */

export type Tone =
  | "brand"
  | "accent"
  | "positive"
  | "watch"
  | "alert"
  | "info"
  | "muted"
  | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  accent: "text-accent",
  positive: "text-positive",
  watch: "text-watch",
  alert: "text-alert",
  info: "text-info",
  muted: "text-muted",
  neutral: "text-ink",
};

const TONE_SOFT: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  watch: "bg-watch-soft text-watch",
  alert: "bg-alert-soft text-alert",
  info: "bg-info-soft text-info",
  muted: "bg-raised text-muted",
  neutral: "bg-raised text-ink",
};

const TONE_FILL: Record<Tone, string> = {
  brand: "bg-brand",
  accent: "bg-accent",
  positive: "bg-positive",
  watch: "bg-watch",
  alert: "bg-alert",
  info: "bg-info",
  muted: "bg-faint",
  neutral: "bg-ink",
};

/** A colour for text or an icon. */
export const toneText = (tone: Tone): string => TONE_TEXT[tone];

/** A tinted background with matching text — chips, callouts, caveats. */
export const toneSoft = (tone: Tone): string => TONE_SOFT[tone];

/** A solid fill — bars, dots, edges. */
export const toneFill = (tone: Tone): string => TONE_FILL[tone];
