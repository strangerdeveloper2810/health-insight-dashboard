import type { Insight } from "@health/core";

import { SEVERITY_STYLE } from "@/lib/theme";

/**
 * How urgent this is, said once.
 *
 * The tone comes from `SEVERITY_STYLE` rather than from a prop with a default,
 * so an insight can never be labelled "worth a look" in red — the word and the
 * colour are looked up from the same severity in the same table.
 */
export const SeverityChip = ({ severity }: { severity: Insight["severity"] }) => {
  const style = SEVERITY_STYLE[severity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium leading-none ${style.chip}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
};
