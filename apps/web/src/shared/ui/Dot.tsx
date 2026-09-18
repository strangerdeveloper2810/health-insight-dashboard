import { toneFill } from "./tone";
import type { Tone } from "./tone";

/** A solid status dot. Always decorative — the text beside it carries the meaning. */
export const Dot = ({ tone = "muted" }: { tone?: Tone }) => {
  return <span className={`size-1.5 shrink-0 rounded-full ${toneFill(tone)}`} aria-hidden />;
};
