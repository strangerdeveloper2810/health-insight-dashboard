import type { ReactNode } from "react";

/**
 * A caveat attached to real data — distinct from an empty state, which says
 * there is no data at all: here the data exists but is too incomplete to read
 * the way it looks.
 */
export const CaveatNote = ({ children }: { children: ReactNode }) => {
  return (
    <p className="flex items-start gap-2 rounded-control bg-watch-soft px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-watch">
      <svg
        viewBox="0 0 24 24"
        className="mt-px size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      <span>{children}</span>
    </p>
  );
};
