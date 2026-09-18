import type { ReactNode } from "react";

import { toneText } from "./tone";
import type { Tone } from "./tone";

/**
 * The readiness dial.
 *
 * `size` and `stroke` are numbers rather than classes because the geometry is
 * arithmetic on the radius — `strokeDasharray` is a circumference. The dial
 * cannot be resized by CSS the way the rest of the page can, so a caller that
 * needs a different size at a breakpoint has to pass one in.
 */
export const Ring = ({
  value,
  size = 132,
  stroke = 12,
  tone = "accent",
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
      className={`relative inline-grid place-items-center ${toneText(tone)}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-sunken"
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
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
};
