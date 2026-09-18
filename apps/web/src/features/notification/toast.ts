import { store } from "@/app/store";
import { addToast, removeToast, clearToasts, type ToastType } from "./slice";

export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    store.dispatch(addToast({ type: "success", title, message, duration }));
  },
  error: (title: string, message?: string, duration?: number) => {
    store.dispatch(addToast({ type: "error", title, message, duration }));
  },
  warning: (title: string, message?: string, duration?: number) => {
    store.dispatch(addToast({ type: "warning", title, message, duration }));
  },
  info: (title: string, message?: string, duration?: number) => {
    store.dispatch(addToast({ type: "info", title, message, duration }));
  },
  custom: (type: ToastType, title: string, message?: string, duration?: number) => {
    store.dispatch(addToast({ type, title, message, duration }));
  },
  dismiss: (id: string) => {
    store.dispatch(removeToast(id));
  },
  clear: () => {
    store.dispatch(clearToasts());
  },
};
