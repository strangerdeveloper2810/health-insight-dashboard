import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { removeToast } from "../slice";
import { ToastItem } from "./ToastItem";

export const ToastContainer = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.notification.toasts);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed top-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={(id) => dispatch(removeToast(id))} />
        </div>
      ))}
    </aside>
  );
};
