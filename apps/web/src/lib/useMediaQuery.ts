/**
 * A CSS media query, as a boolean.
 *
 * Used in exactly one place — the readiness dial, which has to be drawn at a
 * different size on a phone than on a desktop. The dial is an SVG whose
 * geometry depends on its radius, so it cannot be resized by a CSS class the
 * way everything else on the page can; something has to hand it a number.
 */

import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    return typeof window !== "undefined" && window.matchMedia(query).matches;
  });

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);

    // Re-read on mount: the query is part of the deps, so this is also what
    // keeps the value correct if the caller swaps the query for another one.
    onChange();
    list.addEventListener("change", onChange);

    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};
