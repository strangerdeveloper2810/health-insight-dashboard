import type { Insight } from "@health/core";

import { SEVERITY_STYLE } from "@/shared/lib/theme";

/**
 * How urgent this is, said once. Word and colour are both looked up from
 * `SEVERITY_STYLE`, so an insight cannot be labelled "worth a look" in red.
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
