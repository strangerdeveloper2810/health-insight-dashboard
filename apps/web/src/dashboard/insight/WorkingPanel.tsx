import { formatEvidenceValue } from "@health/core";
import type { Insight } from "@health/core";

/**
 * The full audit trail: which rule fired, and every number it read.
 *
 * This exists because the alternative is asking to be trusted. A reader who
 * disagrees with a card can find the exact value they disagree with here, and
 * a reader who wants to know where any of it comes from gets a straight
 * answer rather than a marketing one.
 *
 * The reference ids are shown in mono and in full — they look like
 * `sleep.deep.avg7` because they *are* the key, and truncating a key so it
 * looks tidier would make it useless for cross-checking against the assistant.
 */
export const WorkingPanel = ({ insight }: { insight: Insight }) => {
  return (
    <dl className="mt-3 space-y-1.5 rounded-control bg-raised px-3.5 py-3 text-[0.78rem]">
      <div className="flex gap-2">
        <dt className="w-20 shrink-0 text-faint">Rule</dt>
        <dd className="font-mono text-muted">{insight.rule}</dd>
      </div>
      {insight.evidence.map((ref) => (
        <div key={ref.ref} className="flex gap-2">
          <dt className="w-20 shrink-0 truncate font-mono text-faint" title={ref.ref}>
            {ref.ref}
          </dt>
          <dd className="text-muted">
            {formatEvidenceValue(ref)} — {ref.label}
          </dd>
        </div>
      ))}
      <div className="flex gap-2 border-t border-line pt-2">
        <dt className="w-20 shrink-0 text-faint">Source</dt>
        <dd className="text-muted">
          Computed from your own recordings. The assistant can cite these same values, and
          cannot state a number that is not among them.
        </dd>
      </div>
    </dl>
  );
};
