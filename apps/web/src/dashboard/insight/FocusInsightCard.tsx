import type { Insight } from "@health/core";

import { SEVERITY_STYLE } from "@/lib/theme";
import { EvidenceList } from "./EvidenceList";
import { InsightAction } from "./InsightAction";
import { SeverityChip } from "./SeverityChip";
import { WhyThisButton } from "./WhyThisButton";
import { WorkingPanel } from "./WorkingPanel";
import { useInsightDisclosure } from "./useInsightDisclosure";

/**
 * The one card on the page the reader is meant to act on.
 *
 * It is the only card that carries a colour edge down its left side. Everywhere
 * else the severity chip does the talking, and spending the edge on all of them
 * would flatten the page back to where it started — a grid of equally loud
 * boxes. Exactly one card gets to be loud.
 *
 * It sits on `raised` rather than `surface` so it reads as lifted out of the
 * hero card it lives inside, and its title is serif at a size no feed card
 * reaches, because this is the judgement and the feed is the supporting detail.
 */
export const FocusInsightCard = ({ insight }: { insight: Insight }) => {
  const { open, toggle } = useInsightDisclosure(insight.id);
  const style = SEVERITY_STYLE[insight.severity];

  return (
    <div className="relative overflow-hidden rounded-tile bg-raised px-5 py-5 sm:px-6">
      <span className={`absolute inset-y-0 left-0 w-1 ${style.edge}`} aria-hidden />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityChip severity={insight.severity} />
        <span className="font-display text-[0.8rem] font-semibold text-brand">
          Today&rsquo;s focus
        </span>
      </div>

      <h2 className="mt-3 font-display text-[1.15rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {insight.title}
      </h2>
      <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">{insight.body}</p>

      <InsightAction action={insight.action} prominent />

      {insight.caveat ? (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-watch">{insight.caveat}</p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <EvidenceList insight={insight} />
        <WhyThisButton open={open} onToggle={toggle} />
      </div>

      {open ? <WorkingPanel insight={insight} /> : null}
    </div>
  );
};
