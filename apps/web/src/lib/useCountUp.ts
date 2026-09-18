/**
 * Eases a number to its value instead of snapping to it.
 *
 * The reduced-motion check is synchronous on the first render rather than in an
 * effect, so a reader who asked for less motion never sees a single animated
 * frame.
 */

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = (): boolean => {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
};

const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

export const useCountUp = (value: number, durationMs = 750): number => {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  // Where the next animation starts from. Held in a ref rather than state
  // because it is read inside the frame loop and must not itself re-render.
  const fromRef = useRef(shown);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = from + (value - from) * easeOutCubic(t);
      fromRef.current = next;
      setShown(next);
      frameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [value, durationMs]);

  return shown;
};
