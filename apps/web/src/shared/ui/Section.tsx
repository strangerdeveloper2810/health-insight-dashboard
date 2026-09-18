import type { CSSProperties, ReactNode } from "react";

import { sectionIndex, sectionMeta } from "@/shared/lib/sections";
import type { SectionId } from "@/shared/lib/sections";

/**
 * A top-level block of the page, with its editorial numeral.
 *
 * The label, note and number all come from `lib/sections` keyed by `id`, so a
 * section cannot be numbered or titled differently from the rail item that
 * links to it — there is only one place either is written down. The `--i`
 * custom property is what the `stagger` class reads to delay its entrance.
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
