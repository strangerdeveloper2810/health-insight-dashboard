import type { Insight } from "@health/core";

import { Card } from "@/ui/primitives";
import { EvidenceList } from "./EvidenceList";
import { InsightAction } from "./InsightAction";
import { SeverityChip } from "./SeverityChip";
import { WhyThisButton } from "./WhyThisButton";
import { WorkingPanel } from "./WorkingPanel";
import { useInsightDisclosure } from "./useInsightDisclosure";

/**
 * A feed card: the same content as the focus card, carried with less emphasis.
 */
export const FeedInsightCard = ({ insight }: { insight: Insight }) => {
  const { open, toggle } = useInsightDisclosure(insight.id);

  return (
    <Card interactive className="p-5">
      <SeverityChip severity={insight.severity} />

      <h3 className="mt-3 font-display text-[1.05rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {insight.title}
      </h3>
      <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">{insight.body}</p>

      <InsightAction action={insight.action} />

      {insight.caveat ? (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-watch">{insight.caveat}</p>
      ) : null}

      <div className="mt-3.5">
        <EvidenceList insight={insight} />
      </div>

      <WhyThisButton open={open} onToggle={toggle} className="mt-3" />

      {open ? <WorkingPanel insight={insight} /> : null}
    </Card>
  );
};
