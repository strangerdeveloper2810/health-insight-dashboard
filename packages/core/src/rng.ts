/**
 * Seeded pseudo-random number generation.
 *
 * The dataset is synthetic, but it must not *look* synthetic: charts need
 * day-to-day noise, weekly rhythm, slow drifts and the occasional outlier.
 * A seeded generator gives us all of that while keeping every run
 * reproducible — which is also what makes the insight rules unit-testable.
 */

/** mulberry32 — small, fast, good enough distribution for synthetic data. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box–Muller transform. Health metrics cluster around a personal baseline
 * rather than spreading uniformly, so almost every value we generate is
 * drawn from a normal distribution.
 */
export function gaussian(rng: () => number, mean: number, stdDev: number): number {
  // Guard against log(0), which returns -Infinity.
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/** Clamp a value into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Gaussian draw clamped to a range and rounded — the shape almost every
 * metric in this app wants (steps, heart rate, sodium…).
 */
export function boundedGaussian(
  rng: () => number,
  mean: number,
  stdDev: number,
  min: number,
  max: number,
): number {
  return Math.round(clamp(gaussian(rng, mean, stdDev), min, max));
}

/** True with probability `p`. */
export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

/** Pick one element, uniformly. Returns `undefined` only for an empty list. */
export function pick<T>(rng: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

/** Round to `digits` decimal places, avoiding float dust like 0.30000000000000004. */
export function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
