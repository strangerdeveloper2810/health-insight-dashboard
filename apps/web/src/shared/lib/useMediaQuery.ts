/**
 * A CSS media query, as a boolean. Used by the readiness dial, whose geometry
 * depends on its radius and so cannot be resized by a CSS class — something has
 * to hand it a number.
 */

import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    return typeof window !== "undefined" && window.matchMedia(query).matches;
  });

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);

    // Re-read on mount: the query is in the deps, so this is also what covers a
    // caller swapping it for a different one.
    onChange();
    list.addEventListener("change", onChange);

    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};
