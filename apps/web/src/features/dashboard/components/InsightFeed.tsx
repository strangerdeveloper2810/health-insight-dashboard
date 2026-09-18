/**
 * "What we noticed" — everything except the one the hero already showed, which
 * would otherwise appear twice on the page.
 */

import { useAppSelector } from "@/app/hooks";
import { selectInsights, selectRestInsights } from "@/features/selectors";
import { Card } from "@/shared/ui/primitives";
import { EmptyState } from "@/shared/ui/states";
import { InsightCard } from "./InsightCard";

export const InsightFeed = () => {
  const total = useAppSelector(selectInsights).length;
  const rest = useAppSelector(selectRestInsights);

  if (total === 0) {
    return (
      <EmptyState
        title="Nothing stands out yet"
        message="Your patterns get more interesting as more days accumulate. Once there is a fortnight of consistent data, this is where anything worth your attention will appear."
      />
    );
  }

  // There is one insight in total and the hero has it, so the empty state would
  // contradict the card directly above it.
  if (rest.length === 0) {
    return (
      <Card className="px-5 py-5">
        <p className="text-[0.85rem] leading-relaxed text-muted">
          That is the only pattern worth flagging from the last 90 days. The rest of your
          recordings are inside their usual range.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rest.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
};
