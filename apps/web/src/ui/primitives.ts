/**
 * The design-system surface.
 *
 * Every component lives in its own file next to this one; this barrel exists so
 * call sites import from one name and a component can be moved or split without
 * touching them. It re-exports only — no logic belongs here.
 */

export { Badge } from "./Badge";
export { Bar } from "./Bar";
export { Card } from "./Card";
export { Dot } from "./Dot";
export { Panel } from "./Panel";
export { Ring } from "./Ring";
export { Section } from "./Section";
export { Sparkline } from "./Sparkline";

export { toneFill, toneSoft, toneText } from "./tone";
export type { Tone } from "./tone";
