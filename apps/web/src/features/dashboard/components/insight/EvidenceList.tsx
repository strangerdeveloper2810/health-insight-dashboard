import { formatEvidenceValue } from "@health/core";
import type { Insight } from "@health/core";

/**
 * The figures this insight was computed from, shown on the card rather than
 * behind *Why this?*. Each `ref` is an id in the shared reference index.
 */
export const EvidenceList = ({ insight }: { insight: Insight }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {insight.evidence.map((ref) => (
        <div
          key={ref.ref}
          className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface/50 px-3 py-1.5 min-w-[80px]"
        >
          <span className="text-[0.7rem] uppercase tracking-wider text-faint font-medium">
            {ref.label}
          </span>
          <span className="font-display text-[0.95rem] font-semibold text-ink leading-none">
            {formatEvidenceValue(ref)}
          </span>
        </div>
      ))}
    </div>
  );
};
