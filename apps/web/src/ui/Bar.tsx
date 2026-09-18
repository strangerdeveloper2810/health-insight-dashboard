import { toneFill } from "./tone";
import type { Tone } from "./tone";

/**
 * A horizontal progress bar. Defaults to `accent`, not `brand`: a bar reports a
 * measurement, and terracotta means the product is asking for something.
 */
export const Bar = ({
  value,
  tone = "accent",
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
      className={`h-2 w-full overflow-hidden rounded-full bg-sunken ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${toneFill(tone)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
