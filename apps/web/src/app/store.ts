import { configureStore } from "@reduxjs/toolkit";

import assistant from "@/features/assistantSlice";
import dashboard from "@/features/dashboardSlice";
import ui from "@/features/uiSlice";

export const store = configureStore({
  reducer: { dashboard, assistant, ui },
  // The serialisability check stays on. It is what stops someone putting an
  // AbortController or a Map into state six months from now and discovering
  // the problem only when time-travel debugging silently stops working.
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
