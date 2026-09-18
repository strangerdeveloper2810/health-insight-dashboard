/**
 * The page's sections, in reading order — the single source for the masthead
 * rail, each section's number and note, and the scroll spy's ids. One list is
 * what stops the rail offering a destination the page does not have.
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
  // entry: two rail items at the same scroll position leave one permanently
  // un-highlighted.
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
 * Position in the reading order, 1-based, rendered as `01`. Derived from the
 * array so inserting a section renumbers the ones after it.
 */
export const sectionIndex = (id: SectionId): number =>
  SECTIONS.findIndex((section) => section.id === id) + 1;

export const sectionMeta = (id: SectionId): SectionMeta =>
  SECTIONS.find((section) => section.id === id) as SectionMeta;
