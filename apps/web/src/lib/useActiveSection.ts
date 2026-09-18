/**
 * Which section the reader is currently in, for the masthead's section rail.
 *
 * Deliberately a scroll handler rather than an `IntersectionObserver`. An
 * observer reports entries as they cross a threshold, so with several sections
 * on screen at once the "active" one depends on callback ordering — and the
 * rail would flicker between two neighbours as they trade places. Asking
 * "which section's top has passed the masthead?" has exactly one answer at any
 * scroll position, and it is the one the reader would give.
 *
 * The handler is throttled to one measurement per animation frame, so a fast
 * scroll costs one layout read per frame rather than one per event.
 */

import { useEffect, useState } from "react";

export const useActiveSection = (
  ids: readonly string[],
  /** Distance below the viewport top at which a section counts as reached.
   *  Roughly the sticky masthead, so the highlight changes as the heading
   *  slides under it rather than after. */
  offset = 128,
): string | null => {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      let current: string | null = null;

      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - offset <= 0) current = id;
      }

      // Above the first section — still in the hero — name the first one, so
      // the rail is never blank and the reader always has a position.
      setActive(current ?? ids[0] ?? null);
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids, offset]);

  return active;
};
