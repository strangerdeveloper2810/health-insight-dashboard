import { configureStore } from "@reduxjs/toolkit";

import assistant from "@/features/assistant/slice";
import dashboard from "@/features/dashboard/slice";
import ui from "@/features/layout/slice";
import notification from "@/features/notification/slice";

export const store = configureStore({
  reducer: { dashboard, assistant, ui, notification },
  // The serialisability check stays on: it is what stops an AbortController or
  // a Map reaching state and surfacing only when devtools silently stop working.
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
