/**
 * Chart palettes.
 *
 * Recharts draws to SVG attributes, which cannot read CSS custom properties
 * reliably across browsers, so the chart colours are duplicated here as
 * literals and kept in step with `styles.css` by hand. The duplication is
 * confined to this file.
 *
 * When editing: `brand` here is the *data* colour, not the brand colour. Inside
 * a plot area terracotta would read as a verdict on the series, so charts draw
 * in the petrol teal instead — the same teal the stylesheet calls `accent`.
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
  /** Primary data colour. Named `brand` for historical reasons — see the note above. */
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
  grid: "#ece4d7",
  axis: "#d8cbb7",
  axisText: "#8a7e6d",
  tooltipBg: "#ffffff",
  tooltipBorder: "#ebe3d6",
  tooltipText: "#1c1815",
  brand: "#0f766e",
  brandFill: "rgba(15, 118, 110, 0.14)",
  alt: "#1e5a8a",
  annotation: "rgba(107, 97, 87, 0.15)",
  annotationText: "#6b6157",
  zones: ["#7fb3a8", "#4f9d92", "#d9a13a", "#d1743f", "#b33a2b"],
  sleepStages: { deep: "#2c5f8a", rem: "#6b5aa8", light: "#8fb4d1", awake: "#c9a87c" },
};

const DARK: ChartPalette = {
  grid: "#2b251d",
  axis: "#413a30",
  axisText: "#8a7e6d",
  tooltipBg: "#241f19",
  tooltipBorder: "#3a332a",
  tooltipText: "#f4ede2",
  brand: "#5eead4",
  brandFill: "rgba(94, 234, 212, 0.16)",
  alt: "#7dd3fc",
  annotation: "rgba(179, 167, 148, 0.18)",
  annotationText: "#b3a794",
  zones: ["#4e857c", "#3f8b80", "#c9922f", "#c46a3a", "#a83a28"],
  sleepStages: { deep: "#5b86c9", rem: "#9182cf", light: "#4d7ba8", awake: "#a8946f" },
};

export const CHART_PALETTE: Record<ThemeName, ChartPalette> = { light: LIGHT, dark: DARK };

// ─── Semantic colours for non-chart surfaces ────────────────────────────────

/** Tailwind classes per insight severity. Static strings so Tailwind's scanner
 *  sees them — a computed class name would be stripped from the build. */
export const SEVERITY_STYLE: Record<
  InsightSeverity,
  { chip: string; dot: string; label: string; edge: string }
> = {
  alert: {
    chip: "bg-alert-soft text-alert",
    dot: "bg-alert",
    label: "Needs attention",
    edge: "bg-alert",
  },
  watch: {
    chip: "bg-watch-soft text-watch",
    dot: "bg-watch",
    label: "Worth watching",
    edge: "bg-watch",
  },
  positive: {
    chip: "bg-positive-soft text-positive",
    dot: "bg-positive",
    label: "Going well",
    edge: "bg-positive",
  },
  info: {
    chip: "bg-info-soft text-info",
    dot: "bg-info",
    label: "For context",
    edge: "bg-info",
  },
};

/**
 * A trend verdict, as a tone. Kept separate from `trendOf` so a metric whose
 * good direction is *down* — resting heart rate — can never be coloured by the
 * raw sign of the change. Every call site goes through here for that reason.
 */
export const TREND_TONE: Record<"good" | "bad" | "flat", Tone> = {
  good: "positive",
  bad: "alert",
  flat: "muted",
};

export const READINESS_STYLE: Record<ReadinessBand, { text: string; ring: string; label: string }> = {
  excellent: { text: "text-positive", ring: "stroke-positive", label: "Excellent" },
  good: { text: "text-accent", ring: "stroke-accent", label: "Good" },
  fair: { text: "text-watch", ring: "stroke-watch", label: "Fair" },
  poor: { text: "text-alert", ring: "stroke-alert", label: "Poor" },
};

/** Colours for life-event spans on the time axis. */
export const EVENT_COLOURS: Record<DatasetEvent["kind"], string> = {
  illness: "#b3261e",
  travel: "#1e5a8a",
  "plan-start": "#0f766e",
  race: "#a16207",
  equipment: "#6b5aa8",
  life: "#6b6157",
};
