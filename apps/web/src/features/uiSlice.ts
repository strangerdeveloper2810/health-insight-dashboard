/**
 * Presentation state: theme, which trend is on screen, and which insight card
 * has its reasoning open. All of it is local to this browser and none of it
 * changes what any number means.
 */

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { MetricKey } from "@health/core";

import type { ThemeName } from "@/lib/theme";

export type ThemeChoice = ThemeName | "system";
export type TrendRange = "7d" | "30d" | "90d";

export interface UiState {
  /** What the user picked. */
  themeChoice: ThemeChoice;
  /** What that resolves to right now, kept in sync with the class on <html>. */
  theme: ThemeName;
  trendMetric: MetricKey;
  trendRange: TrendRange;
  /** The insight whose "Why?" panel is open, if any. */
  openInsight: string | null;
  /** Which life events are shaded on the trend chart. */
  showEvents: boolean;
}

const initialState: UiState = {
  themeChoice: "system",
  theme: "light",
  // Resting heart rate leads, because the flagship finding in this dataset is
  // about sleep and recovery rather than volume.
  trendMetric: "restingHeartRate",
  trendRange: "30d",
  openInsight: null,
  showEvents: true,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    themeResolved: (state, action: PayloadAction<ThemeName>) => {
      state.theme = action.payload;
    },
    themeChosen: (state, action: PayloadAction<ThemeChoice>) => {
      state.themeChoice = action.payload;
    },
    trendMetricChanged: (state, action: PayloadAction<MetricKey>) => {
      state.trendMetric = action.payload;
    },
    trendRangeChanged: (state, action: PayloadAction<TrendRange>) => {
      state.trendRange = action.payload;
    },
    /** Opening one card closes the other: two open panels is a wall of text. */
    insightToggled: (state, action: PayloadAction<string>) => {
      state.openInsight = state.openInsight === action.payload ? null : action.payload;
    },
    eventsToggled: (state) => {
      state.showEvents = !state.showEvents;
    },
  },
});

export const {
  themeResolved,
  themeChosen,
  trendMetricChanged,
  trendRangeChanged,
  insightToggled,
  eventsToggled,
} = uiSlice.actions;

export default uiSlice.reducer;
