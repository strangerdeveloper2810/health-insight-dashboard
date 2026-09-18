import type { ReactNode } from "react";

/**
 * A panel of the page.
 *
 * No border. The card is lifted off the paper with a warm shadow instead,
 * which is what keeps a screen of eight sections from reading as a grid of
 * boxes — and in the dark theme a hairline border would be the only thing
 * separating two near-identical darks, so elevation does that job too.
 *
 * A plain `div` rather than a `section`: this is a presentational container,
 * and a page of eight of them would announce eight landmarks to a screen
 * reader, none of which mean anything. The landmarks come from `Section` and
 * from `Panel` where it carries a section id.
 *
 * `id` is here so a card can be an anchor target for the section rail without
 * the caller wrapping it in an extra element purely to hold an attribute.
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
