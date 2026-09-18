import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectUi } from "@/features/selectors";
import { insightToggled } from "@/features/uiSlice";

/**
 * The open insight lives in the store, not in `useState`, so that opening one
 * card closes the others. Per-card state would let four readers stack four sets
 * of tables down the page with no way to tell which belongs to which.
 */
export const useInsightDisclosure = (insightId: string) => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectUi).openInsight === insightId;

  return {
    open,
    toggle: () => dispatch(insightToggled(insightId)),
  };
};
