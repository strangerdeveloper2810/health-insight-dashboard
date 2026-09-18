/**
 * The small parts the whole dashboard is built from.
 *
 * Deliberately not a component library — five shapes cover every panel, and
 * the value of the file is that a "card" looks the same in the sleep section
 * as it does in the assistant.
 */

import type { ReactNode } from "react";

import type { SeriesPoint } from "@health/core";

export type Tone = "brand" | "positive" | "watch" | "alert" | "info" | "muted" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  positive: "text-positive",
  watch: "text-watch",
  alert: "text-alert",
  info: "text-info",
  muted: "text-muted",
  neutral: "text-ink",
};

const TONE_SOFT: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand border-brand/25",
  positive: "bg-positive-soft text-positive border-positive/25",
  watch: "bg-watch-soft text-watch border-watch/25",
  alert: "bg-alert-soft text-alert border-alert/25",
  info: "bg-info-soft text-info border-info/25",
  muted: "bg-raised text-muted border-line",
  neutral: "bg-raised text-ink border-line",
};

const TONE_FILL: Record<Tone, string> = {
  brand: "bg-brand",
  positive: "bg-positive",
  watch: "bg-watch",
  alert: "bg-alert",
  info: "bg-info",
  muted: "bg-faint",
  neutral: "bg-ink",
};

export const toneText = (tone: Tone): string => {
  return TONE_TEXT[tone];
};

// ─── Surfaces ───────────────────────────────────────────────────────────────

export const Card = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <section
      className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(13,27,42,0.04)] ${className}`}
    >
      {children}
    </section>
  );
};

export const Panel = ({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => {
  return (
    <Card className={className}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {/* Full-width on a phone so controls get a row of their own to wrap
            inside, and their natural size from `sm` up. A plain `shrink-0` here
            leaves a wide control — a native select, say — with nowhere to go,
            and it pushes the whole page sideways. */}
        {action ? <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div> : null}
      </header>
      <div className={`px-4 py-4 sm:px-5 ${bodyClassName}`}>{children}</div>
    </Card>
  );
};

// ─── Labels ─────────────────────────────────────────────────────────────────

export const Badge = ({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_SOFT[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

export const Dot = ({ tone = "muted" }: { tone?: Tone }) => {
  return <span className={`size-1.5 rounded-full ${TONE_FILL[tone]}`} aria-hidden />;
};

// ─── Progress ───────────────────────────────────────────────────────────────

export const Bar = ({
  value,
  tone = "brand",
  label,
  className = "",
}: {
  /** 0–100. Values outside are clamped rather than rejected. */
  value: number;
  tone?: Tone;
  label?: string;
  className?: string;
}) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-raised ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${TONE_FILL[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

/**
 * The readiness dial.
 *
 * A ring rather than a bar because the score is the one number on the page
 * that is a judgement about today rather than a measurement, and it should not
 * look like the others.
 */
export const Ring = ({
  value,
  size = 132,
  stroke = 10,
  tone = "brand",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: ReactNode;
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  // SVG cannot read the CSS custom properties, so the ring uses currentColor
  // and inherits its tone from a Tailwind text utility on the wrapper.
  return (
    <div
      className={`relative inline-grid place-items-center ${TONE_TEXT[tone]}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
};

// ─── Sparkline ──────────────────────────────────────────────────────────────

/**
 * A 30-point trend in about 100 pixels.
 *
 * Hand-drawn rather than a Recharts instance: a charting library per tile
 * costs a responsive container, a resize observer and a tooltip layer for
 * something whose entire job is to say "up" or "down" at a glance.
 */
export const Sparkline = ({
  points,
  tone = "brand",
  width = 108,
  height = 30,
  className = "",
}: {
  points: SeriesPoint[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
}) => {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const pad = 3;

  const coords = values.map((value, index) => {
    const x = index * stepX;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`${TONE_TEXT[tone]} ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
