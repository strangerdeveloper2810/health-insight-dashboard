import type { ReactNode } from "react";

import { toneSoft } from "./tone";
import type { Tone } from "./tone";

/** A small tinted label. The tint alone separates it from paper — no border. */
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-medium leading-none ${toneSoft(tone)} ${className}`}
    >
      {children}
    </span>
  );
};
