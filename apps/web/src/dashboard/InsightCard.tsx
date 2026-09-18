/**
 * One observation, with its working.
 *
 * Every card can show its evidence. Pressing *Why this?* reveals the rule that
 * fired and the exact figures it read, each one a reference from the same
 * index the assistant cites. That is the difference between a dashboard that
 * tells you something and one that asks to be trusted.
 *
 * The suggested action is deliberately specific — "move lights-out twenty
 * minutes earlier on weeknights", not "improve your sleep". Generic advice is
 * indistinguishable from a horoscope, and the rules that produce these cards
 * know enough to be concrete.
 *
 * Two variants, one entry point, because the difference between them is
 * emphasis and not content: the hero's focus card is the one the reader is
 * meant to act on, and the feed is the rest of the list. Routing both through
 * here is what stops the promoted card from drifting out of step with the
 * others — the shared pieces (evidence, action, working, disclosure) live in
 * `./insight/` and are assembled, not duplicated, by each variant.
 */

import type { Insight } from "@health/core";

import { FeedInsightCard } from "./insight/FeedInsightCard";
import { FocusInsightCard } from "./insight/FocusInsightCard";

export const InsightCard = ({
  insight,
  variant = "card",
}: {
  insight: Insight;
  variant?: "card" | "focus";
}) => {
  return variant === "focus" ? (
    <FocusInsightCard insight={insight} />
  ) : (
    <FeedInsightCard insight={insight} />
  );
};
