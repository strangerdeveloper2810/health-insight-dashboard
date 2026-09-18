/**
 * "What we noticed" — everything except the one the hero already showed.
 *
 * The most urgent observation is promoted to the top of the page and is not
 * repeated here. That leaves this section as a genuine list: the second,
 * third and fourth things worth knowing, each with the figures behind it, for
 * a reader who has already dealt with the first.
 *
 * The card itself lives in `InsightCard`, shared with the hero, so the two can
 * never disagree about how an insight is rendered.
 */

import { useAppSelector } from "@/app/hooks";
import { selectInsights, selectRestInsights } from "@/features/selectors";
import { Card } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";
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

  // One insight total, and the hero has it. Saying "nothing stands out yet"
  // under a card that stands out would read as a bug.
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
