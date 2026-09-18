import { useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "./store";

/** Pre-typed so components never restate the store's shape. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
