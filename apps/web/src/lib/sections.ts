/**
 * The page's sections, in the order they are read.
 *
 * One list, four consumers: the masthead rail navigates by it, each section
 * takes its number and its note from its position in it, and the scroll spy
 * matches against its ids. Keeping them in one place is what stops the rail
 * from offering a destination the page does not have — which is the failure
 * mode of a hand-written table of contents, and the reason a long dashboard
 * needs one at all.
 *
 * The note is here rather than at the call site for the same reason the label
 * is: it is the one-line answer to "what is in this section", and it should say
 * the same thing whether the reader meets it as a heading, as a tooltip on the
 * rail, or as a link someone sent them.
 *
 * The order is the product argument, restated from `App`: how am I, why, what
 * should I do, and then everything that explains it.
 */

export const SECTIONS = [
  { id: "today", label: "Today", note: "" },
  {
    id: "noticed",
    label: "Noticed",
    note: "Patterns found in your recordings, each with the figures behind it",
  },
  { id: "trends", label: "Trends", note: "Where each measurement is heading" },
  { id: "goals", label: "Goals", note: "Measured the way each one actually works" },
  // Sleep and activity sit side by side on a wide screen, so they share one
  // entry: two rail items pointing at the same scroll position would leave one
  // of them permanently un-highlighted.
  { id: "daily", label: "Sleep & activity", note: "The detail behind today's score" },
  { id: "nutrition", label: "Nutrition", note: "Intake from your food log" },
  {
    id: "context",
    label: "Context",
    note: "What shapes how everything above should be read",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export interface SectionMeta {
  id: SectionId;
  label: string;
  note: string;
}

/** A stable identity for the scroll spy, which depends on the array. */
export const SECTION_IDS: readonly string[] = SECTIONS.map((section) => section.id);

/**
 * Position in the reading order, 1-based, rendered as `01`.
 *
 * Derived from the array rather than written down, so inserting a section
 * renumbers the ones after it instead of leaving two of them claiming `04`.
 */
export const sectionIndex = (id: SectionId): number =>
  SECTIONS.findIndex((section) => section.id === id) + 1;

export const sectionMeta = (id: SectionId): SectionMeta =>
  SECTIONS.find((section) => section.id === id) as SectionMeta;
