import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { ToastItem as ToastItemType } from "../slice";

interface ToastItemProps {
  toast: ToastItemType;
  onDismiss: (id: string) => void;
}

export const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef<number>(toast.duration ?? 4500);

  useEffect(() => {
    if (isPaused) return;

    const totalDuration = toast.duration ?? 4500;
    const interval = 25; // update every 25ms

    const timer = setInterval(() => {
      remainingTimeRef.current -= interval;
      const pct = Math.max(0, (remainingTimeRef.current / totalDuration) * 100);
      setProgress(pct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(timer);
        onDismiss(toast.id);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, toast.id, toast.duration, onDismiss]);

  const config = {
    success: {
      icon: CheckCircle2,
      iconClass: "text-emerald-500 bg-emerald-500/10",
      progressClass: "bg-emerald-500",
      accentBorder: "border-l-emerald-500",
    },
    error: {
      icon: AlertCircle,
      iconClass: "text-rose-500 bg-rose-500/10",
      progressClass: "bg-rose-500",
      accentBorder: "border-l-rose-500",
    },
    warning: {
      icon: AlertTriangle,
      iconClass: "text-amber-500 bg-amber-500/10",
      progressClass: "bg-amber-500",
      accentBorder: "border-l-amber-500",
    },
    info: {
      icon: Info,
      iconClass: "text-sky-500 bg-sky-500/10",
      progressClass: "bg-sky-500",
      accentBorder: "border-l-sky-500",
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`group relative overflow-hidden rounded-xl border border-line bg-surface/95 backdrop-blur-md p-3.5 shadow-xl transition-all duration-200 hover:shadow-2xl border-l-4 ${config.accentBorder} animate-in fade-in slide-in-from-top-2`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${config.iconClass}`}>
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold text-ink tracking-tight">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-3">
              {toast.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-raised hover:text-ink"
          aria-label="Dismiss notification"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-line/40">
        <div
          className={`h-full ${config.progressClass} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
