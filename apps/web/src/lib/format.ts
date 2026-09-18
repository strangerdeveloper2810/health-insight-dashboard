/**
 * Value formatting. Every number the user reads goes through
 * `formatEvidenceValue` from `@health/core` — the same formatter the
 * assistant's citations use, so a tile and a cited reference cannot disagree
 * about rounding or unit placement.
 */

import { formatEvidenceValue } from "@health/core";
import type { EvidenceRef, MetricMeta } from "@health/core";

/** The parts of a reference that decide how its value looks. */
export type ValueShape = Pick<EvidenceRef, "unit" | "precision" | "format">;

export const shapeOf = (meta: MetricMeta): ValueShape => {
  return {
    unit: meta.unit,
    precision: meta.precision,
    format: meta.unit === "min" ? "duration" : meta.unit === "clock" ? "clock" : "number",
  };
};

/** Full rendering, unit included: "8,432 steps", "7h 12m", "23:40". */
export const formatValue = (value: number, shape: ValueShape): string => {
  return formatEvidenceValue({ ref: "", label: "", value, ...shape });
};

/**
 * The figure alone, for tiles that set the unit in smaller type beside it.
 * Durations and clock times come back whole — splitting "7h 12m" across two
 * elements would break the pairing the formatter chose.
 */
export const formatBare = (value: number, shape: ValueShape): string => {
  if (shape.format === "duration" || shape.format === "clock") {
    return formatValue(value, shape);
  }
  return formatValue(value, { ...shape, unit: "" }).trim();
};

/** The unit as it should appear next to a bare value. */
export const unitSuffix = (shape: ValueShape): string => {
  if (shape.format === "duration" || shape.format === "clock") return "";
  return shape.unit === "%" ? "" : shape.unit;
};

// ─── Deltas ─────────────────────────────────────────────────────────────────

export type Direction = "up" | "down" | "flat";

export const directionOf = (change: number | null, epsilon = 0.05): Direction => {
  if (change === null || Math.abs(change) < epsilon) return "flat";
  return change > 0 ? "up" : "down";
};

/**
 * Whether a change is good news. Resolved against the metric's own
 * `goodDirection` rather than the sign: a rising resting heart rate and a
 * rising step count point opposite ways. `neutral` metrics are never coloured —
 * this app has no opinion about which way they should move.
 */
export const trendOf = (
  change: number | null,
  goodDirection: MetricMeta["goodDirection"],
): "good" | "bad" | "flat" => {
  const direction = directionOf(change);
  if (direction === "flat" || goodDirection === "neutral") return "flat";
  const isGood = goodDirection === "up" ? direction === "up" : direction === "down";
  return isGood ? "good" : "bad";
};

/** Signed percentage for display: "+4.2%", "−1.8%", "no change". */
export const formatChange = (change: number | null, precision = 1): string => {
  if (change === null) return "no prior data";
  if (Math.abs(change) < 0.05) return "no change";
  // A real minus sign, not a hyphen: it aligns with digits in tabular figures.
  const sign = change > 0 ? "+" : "−";
  return `${sign}${Math.abs(change).toFixed(precision)}%`;
};

// ─── Time ───────────────────────────────────────────────────────────────────

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "Thu 14" — the weekday matters more than the month for a 30-day window. */
export const formatAxisDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  return `${WEEKDAY.format(date)} ${date.getDate()}`;
};

export const formatDayMonth = (iso: string): string => {
  return DAY_MONTH.format(new Date(`${iso}T00:00:00`));
};

export const formatRange = (start: string, end: string): string => {
  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
};
