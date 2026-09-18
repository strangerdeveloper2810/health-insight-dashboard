import { formatEvidenceValue } from "@health/core";
import type { Insight } from "@health/core";

/**
 * The figures this insight was computed from, shown on the card rather than
 * behind *Why this?*. Each `ref` is an id in the shared reference index — the
 * same one the assistant is restricted to.
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
