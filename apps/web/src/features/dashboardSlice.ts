/**
 * The dashboard's slice: one payload and a request status, nothing else. No
 * averaging or derived values — those were computed once on the server, and a
 * second implementation in the browser is the bug this architecture exists to
 * prevent.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { DashboardPayload, MetricKey } from "@health/core";

import { ApiError, fetchDashboard } from "@/api/client";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface DashboardState {
  status: LoadStatus;
  payload: DashboardPayload | null;
  error: { message: string; code: string } | null;
}

const initialState: DashboardState = {
  status: "idle",
  payload: null,
  error: null,
};

export const loadDashboard = createAsyncThunk<
  DashboardPayload,
  void,
  { rejectValue: { message: string; code: string } }
>("dashboard/load", async (_arg, { rejectWithValue, signal }) => {
  try {
    return await fetchDashboard(signal);
  } catch (error) {
    if (error instanceof ApiError) {
      return rejectWithValue({ message: error.message, code: error.code });
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return rejectWithValue({
      message: "Something went wrong loading your dashboard. Your data is safe.",
      code: "unknown",
    });
  }
});

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    /** Used by the retry button, which needs a clean slate before reloading. */
    reset: (state) => {
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDashboard.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadDashboard.fulfilled, (state, action: PayloadAction<DashboardPayload>) => {
        state.status = "ready";
        state.payload = action.payload;
      })
      .addCase(loadDashboard.rejected, (state, action) => {
        // An aborted load is not a failure the user should see — the component
        // that started it has already unmounted.
        if (action.meta.aborted) return;
        state.status = "error";
        state.error = action.payload ?? {
          message: action.error.message ?? "Unknown error",
          code: "unknown",
        };
      });
  },
});

export const { reset: resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;

/** Metrics that carry a real series, for the trends switcher. */
export const availableMetrics = (payload: DashboardPayload): MetricKey[] => {
  return (Object.keys(payload.series) as MetricKey[]).filter(
    (key) => (payload.series[key]?.length ?? 0) > 1,
  );
};
