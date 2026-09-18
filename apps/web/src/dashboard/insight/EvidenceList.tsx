import { formatEvidenceValue } from "@health/core";
import type { Insight } from "@health/core";

/**
 * The figures this insight was computed from.
 *
 * Shown on the card rather than hidden behind *Why this?*, because the first
 * question a reader has about a claim like "your resting heart rate is up" is
 * "by how much" — and making them press a button to find out is how a
 * dashboard ends up feeling like it is hiding something.
 *
 * Each `ref` is an id in the shared reference index, which is the same index
 * the assistant is restricted to. That is what makes the sentence "the
 * assistant can cite these same values" true rather than aspirational.
 */
export const EvidenceList = ({ insight }: { insight: Insight }) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {insight.evidence.map((ref) => (
        <span
          key={ref.ref}
          className="inline-flex items-baseline gap-1.5 rounded-control bg-raised px-2.5 py-1 text-[0.75rem] leading-tight"
        >
          <span className="text-faint">{ref.label}</span>
          <span className="font-medium text-ink">{formatEvidenceValue(ref)}</span>
        </span>
      ))}
    </div>
  );
};
