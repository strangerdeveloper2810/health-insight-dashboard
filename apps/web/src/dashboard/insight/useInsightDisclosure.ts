import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectUi } from "@/features/selectors";
import { insightToggled } from "@/features/uiSlice";

/**
 * Whether this card's working is showing, and how to toggle it.
 *
 * The open insight lives in the store rather than in local state so that only
 * one card is ever expanded. With `useState` each card would open
 * independently, and a reader who presses *Why this?* on four cards ends up
 * with four sets of tables stacked down the page and no way to tell which
 * belongs to which.
 *
 * Shared by both variants so the focus card and the feed cards cannot drift
 * apart on the behaviour, only on the styling.
 */
export const useInsightDisclosure = (insightId: string) => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectUi).openInsight === insightId;

  return {
    open,
    toggle: () => dispatch(insightToggled(insightId)),
  };
};
