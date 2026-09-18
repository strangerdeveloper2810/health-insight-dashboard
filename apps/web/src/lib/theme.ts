/**
 * Chart palettes.
 *
 * Recharts draws to SVG attributes, which cannot read CSS custom properties
 * reliably across browsers, so the chart colours are duplicated here as
 * literals. They are kept in step with `styles.css` by hand — the alternative
 * is resolving computed styles at runtime, which breaks on first paint and in
 * tests. The duplication is confined to this file.
 */

import type { DatasetEvent, InsightSeverity, ReadinessBand } from "@health/core";

import type { Tone } from "@/ui/primitives";

export type ThemeName = "light" | "dark";

export interface ChartPalette {
  grid: string;
  axis: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  /** Primary data colour. */
  brand: string;
  /** Softer fill under an area or bar. */
  brandFill: string;
  /** Second series, when two metrics share an axis. */
  alt: string;
  /** Shaded span marking a life event on the time axis. */
  annotation: string;
  annotationText: string;
  /** Heart-rate zones 1–5, easy to hard. */
  zones: [string, string, string, string, string];
  sleepStages: { deep: string; rem: string; light: string; awake: string };
}

const LIGHT: ChartPalette = {
  grid: "#e6ecf3",
  axis: "#cbd6e2",
  axisText: "#71829a",
  tooltipBg: "#ffffff",
  tooltipBorder: "#dbe3ec",
  tooltipText: "#0d1b2a",
  brand: "#0e7c6b",
  brandFill: "rgba(14, 124, 107, 0.14)",
  alt: "#1c6aa8",
  annotation: "rgba(91, 107, 127, 0.16)",
  annotationText: "#5b6b7f",
  zones: ["#8fb8ae", "#4f9f8d", "#e0a33a", "#dd7a45", "#c0432f"],
  sleepStages: { deep: "#2f5d9e", rem: "#6f5aa8", light: "#7fa8cf", awake: "#c9b08a" },
};

const DARK: ChartPalette = {
  grid: "#1b2634",
  axis: "#2c3b4c",
  axisText: "#8395a8",
  tooltipBg: "#131e2c",
  tooltipBorder: "#26374a",
  tooltipText: "#e9eff6",
  brand: "#3ecbae",
  brandFill: "rgba(62, 203, 174, 0.16)",
  alt: "#63aee6",
  annotation: "rgba(154, 171, 189, 0.18)",
  annotationText: "#9aabbd",
  zones: ["#5c8a80", "#3f8b7a", "#c9922f", "#c46a3a", "#a83a28"],
  sleepStages: { deep: "#5b86c9", rem: "#9182cf", light: "#4d7ba8", awake: "#a8946f" },
};

export const CHART_PALETTE: Record<ThemeName, ChartPalette> = { light: LIGHT, dark: DARK };

// ─── Semantic colours for non-chart surfaces ────────────────────────────────

/** Tailwind classes per insight severity. Static strings so Tailwind's scanner
 *  sees them — a computed class name would be stripped from the build. */
export const SEVERITY_STYLE: Record<
  InsightSeverity,
  { chip: string; dot: string; label: string }
> = {
  alert: {
    chip: "bg-alert-soft text-alert border-alert/25",
    dot: "bg-alert",
    label: "Needs attention",
  },
  watch: {
    chip: "bg-watch-soft text-watch border-watch/25",
    dot: "bg-watch",
    label: "Worth watching",
  },
  positive: {
    chip: "bg-positive-soft text-positive border-positive/25",
    dot: "bg-positive",
    label: "Going well",
  },
  info: {
    chip: "bg-info-soft text-info border-info/25",
    dot: "bg-info",
    label: "For context",
  },
};

/**
 * A trend verdict, as a tone.
 *
 * `trendOf` answers "is this movement good or bad for the user?" — a question
 * about the metric, not about colour. The two vocabularies stay separate so a
 * metric whose good direction is *down* (resting heart rate, resting HRV's
 * inverse) can never be coloured by the raw sign of the change. Every call site
 * goes through here for the same reason.
 */
export const TREND_TONE: Record<"good" | "bad" | "flat", Tone> = {
  good: "positive",
  bad: "alert",
  flat: "muted",
};

export const READINESS_STYLE: Record<ReadinessBand, { text: string; ring: string; label: string }> = {
  excellent: { text: "text-positive", ring: "stroke-positive", label: "Excellent" },
  good: { text: "text-brand", ring: "stroke-brand", label: "Good" },
  fair: { text: "text-watch", ring: "stroke-watch", label: "Fair" },
  poor: { text: "text-alert", ring: "stroke-alert", label: "Poor" },
};

/** Colours for life-event spans on the time axis. */
export const EVENT_COLOURS: Record<DatasetEvent["kind"], string> = {
  illness: "#bb3a2c",
  travel: "#1c6aa8",
  "plan-start": "#0e7c6b",
  race: "#a86400",
  equipment: "#6f5aa8",
  life: "#5b6b7f",
};
