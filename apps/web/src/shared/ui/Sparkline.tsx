import { useId } from "react";

import type { SeriesPoint } from "@health/core";

import { toneText } from "./tone";
import type { Tone } from "./tone";

/**
 * A 30-point trend in about 100 pixels.
 *
 * Hand-drawn rather than a Recharts instance: a charting library per tile costs
 * a responsive container, a resize observer and a tooltip layer for something
 * whose entire job is to say "up" or "down" at a glance.
 */
export const Sparkline = ({
  points,
  tone = "accent",
  width = 108,
  height = 30,
  className = "",
  filled = true,
}: {
  points: SeriesPoint[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
  filled?: boolean;
}) => {
  // `useId` so two sparklines in different tones cannot share a gradient. The
  // colons React generates are legal in a fragment reference but come out
  // anyway, as they are not worth the argument.
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

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
      className={`${toneText(tone)} ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {filled ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`${coords.join(" ")} ${width},${height} 0,${height}`}
            fill={`url(#${gradientId})`}
          />
        </>
      ) : null}
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
