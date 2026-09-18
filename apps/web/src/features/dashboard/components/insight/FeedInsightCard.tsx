import type { Insight } from "@health/core";

import { Card } from "@/shared/ui/primitives";
import { EvidenceList } from "./EvidenceList";
import { InsightAction } from "./InsightAction";
import { SeverityChip } from "./SeverityChip";
import { WhyThisButton } from "./WhyThisButton";
import { WorkingPanel } from "./WorkingPanel";
import { useInsightDisclosure } from "./useInsightDisclosure";

/**
 * A feed card: the same content as the focus card, carried with less emphasis.
 * Refactored to reduce text density.
 */
export const FeedInsightCard = ({ insight }: { insight: Insight }) => {
  const { open, toggle } = useInsightDisclosure(insight.id);

  return (
    <Card interactive className="p-5 flex flex-col h-full">
      <SeverityChip severity={insight.severity} />

      <h3 className="mt-3 font-display text-[1.05rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {insight.title}
      </h3>
      
      {/* Visual simplification: Removed long insight.body paragraph */}

      <InsightAction action={insight.action} />

      {insight.caveat ? (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-watch">{insight.caveat}</p>
      ) : null}

      <div className="mt-auto pt-4 flex flex-col gap-3">
        <EvidenceList insight={insight} />
        <WhyThisButton open={open} onToggle={toggle} />
      </div>

      {open ? <WorkingPanel insight={insight} /> : null}
    </Card>
  );
};
