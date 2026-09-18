import { SECTIONS, SECTION_IDS } from "@/lib/sections";
import { useActiveSection } from "@/lib/useActiveSection";

/**
 * The index of the page, always on screen. The list comes from `lib/sections`
 * — the same module the sections render their anchors and numerals from — so a
 * section cannot exist in the page without appearing here.
 *
 * The negative margins are deliberate: on a phone the rail scrolls under the
 * page gutter rather than stopping short of it, which is what makes the row
 * read as scrollable rather than as a row that happens to be cut off.
 */
export const SectionRail = () => {
  const active = useActiveSection(SECTION_IDS);

  return (
    <nav
      aria-label="Sections"
      className="scroll-slim -mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
    >
      {SECTIONS.map((section) => {
        const current = active === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={current ? "true" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-[0.78rem] font-medium leading-none transition ${
              current ? "bg-brand-soft text-brand" : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
};
