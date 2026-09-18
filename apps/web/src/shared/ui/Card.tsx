import type { ReactNode } from "react";

/**
 * A panel of the page. A `div`, not a `section`: a page of eight of these would
 * announce eight landmarks to a screen reader, none of them meaningful.
 */
export const Card = ({
  children,
  className = "",
  id,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Makes the card an anchor target. Pair with `scroll-mt-*` on the caller. */
  id?: string;
  /** Adds a hover lift. Only for cards that are themselves clickable. */
  interactive?: boolean;
}) => {
  return (
    <div
      id={id}
      className={`rounded-card bg-surface shadow-card ${
        interactive
          ? "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
