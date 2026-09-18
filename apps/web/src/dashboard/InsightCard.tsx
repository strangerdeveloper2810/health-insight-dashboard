/**
 * One observation, with its working. The two variants differ in emphasis, not
 * content, and assemble the same pieces from `./insight/` — which is what stops
 * the promoted focus card from drifting out of step with the feed.
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
