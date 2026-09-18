import type { CSSProperties, ReactNode } from "react";

import { sectionIndex, sectionMeta } from "@/lib/sections";
import type { SectionId } from "@/lib/sections";

/**
 * A top-level block of the page, with its editorial numeral.
 *
 * The numeral is not decoration. A page this long is read in two ways — top to
 * bottom the first time, and by jumping to one part of it every time after —
 * and a numbered heading gives the reader a position they can hold in their
 * head ("I was at four") as well as something for the rail to point at.
 *
 * The title, the number and the note all come from `lib/sections` from the id
 * alone. A section cannot be numbered wrongly or titled differently from the
 * rail item that links to it, because there is only one place either is
 * written down.
 *
 * `stagger` delays this section's entrance by its own index, so the page
 * arrives in reading order rather than all at once.
 */
export const Section = ({
  id,
  children,
  className = "",
}: {
  id: SectionId;
  children: ReactNode;
  className?: string;
}) => {
  const { label, note } = sectionMeta(id);
  const index = sectionIndex(id);

  return (
    <section
      id={id}
      className={`stagger scroll-mt-28 ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[0.95rem] font-semibold leading-none text-brand tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-display text-[1.6rem] font-semibold leading-none tracking-[-0.015em] text-ink">
          {label}
        </h2>
        <span aria-hidden className="hidden h-px min-w-8 flex-1 self-center bg-line sm:block" />
        {note ? <p className="w-full text-[0.8rem] text-faint sm:w-auto">{note}</p> : null}
      </header>
      {children}
    </section>
  );
};
