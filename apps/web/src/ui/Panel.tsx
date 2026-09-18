import type { ReactNode } from "react";

import { Card } from "./Card";

/**
 * A card with a titled header and an optional control on the right.
 *
 * Whether it carries an `id` decides what it is. With one it *is* a section —
 * the rail links to it and its title is an `h2`, so a single-panel section gets
 * its heading from the panel rather than a wrapper that would say the same
 * thing twice. Without one it is a panel inside a section, so the title steps
 * down to `h3` and takes no numeral; the section already numbered it.
 */
export const Panel = ({
  id,
  index,
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  /** Present when this panel is itself a top-level section. */
  id?: string;
  /** 1-based position in the section rail. Only meaningful alongside `id`. */
  index?: number;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => {
  const Heading = id ? "h2" : "h3";

  return (
    <Card id={id} className={id ? `scroll-mt-28 ${className}` : className}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {index !== undefined ? (
              <span
                className="font-display text-[0.95rem] font-semibold leading-none text-brand tabular-nums"
                aria-hidden
              >
                {String(index).padStart(2, "0")}
              </span>
            ) : null}
            <Heading
              className={
                id
                  ? "font-display text-[1.35rem] font-semibold leading-none tracking-[-0.015em] text-ink"
                  : "text-[0.95rem] font-semibold tracking-tight text-ink"
              }
            >
              {title}
            </Heading>
          </div>
          {subtitle ? <p className="mt-1.5 text-[0.8rem] text-muted">{subtitle}</p> : null}
        </div>
        {/* Full-width on a phone so controls get a row of their own to wrap
            inside. A plain `shrink-0` leaves a wide control — a native select,
            say — with nowhere to go, and it pushes the page sideways. */}
        {action ? <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div> : null}
      </header>
      <div className={`px-5 py-5 sm:px-6 ${bodyClassName}`}>{children}</div>
    </Card>
  );
};
