import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
}

interface NotificationState {
  toasts: ToastItem[];
}

const initialState: NotificationState = {
  toasts: [],
};

export const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    addToast: {
      reducer: (state, action: PayloadAction<ToastItem>) => {
        // Keep max 5 toasts visible at once
        if (state.toasts.length >= 5) {
          state.toasts.shift();
        }
        state.toasts.push(action.payload);
      },
      prepare: (payload: Omit<ToastItem, "id"> & { id?: string }) => {
        return {
          payload: {
            ...payload,
            id: payload.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            duration: payload.duration ?? 4500,
          },
        };
      },
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
  },
});

export const { addToast, removeToast, clearToasts } = notificationSlice.actions;
export default notificationSlice.reducer;
