import { configureStore } from "@reduxjs/toolkit";

import assistant from "@/features/assistantSlice";
import dashboard from "@/features/dashboardSlice";
import ui from "@/features/uiSlice";

export const store = configureStore({
  reducer: { dashboard, assistant, ui },
  // The serialisability check stays on: it is what stops an AbortController or
  // a Map reaching state and surfacing only when devtools silently stop working.
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
