import type { Insight } from "@health/core";
import { Lightbulb } from "lucide-react";

/**
 * The one thing to do about it.
 */
export const InsightAction = ({
  action,
  prominent = false,
}: {
  action: Insight["action"];
  prominent?: boolean;
}) => {
  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-[0.85rem] leading-relaxed text-ink ${
        prominent ? "bg-surface shadow-card border border-line" : "bg-brand-soft/50"
      }`}
    >
      <div className="shrink-0 mt-0.5 text-brand">
        <Lightbulb size={18} strokeWidth={2.5} />
      </div>
      <div>
        <span className="font-semibold text-brand block mb-0.5">Try this</span>
        <span className="text-muted leading-tight">{action}</span>
      </div>
    </div>
  );
};
