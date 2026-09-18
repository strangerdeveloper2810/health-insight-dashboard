import type { Insight } from "@health/core";

/**
 * The one thing to do about it. `prominent` lifts it onto its own surface: the
 * focus card sits on a `raised` ground, where a `brand-soft` block would read as
 * another chip rather than as the answer.
 */
export const InsightAction = ({
  action,
  prominent = false,
}: {
  action: Insight["action"];
  prominent?: boolean;
}) => {
  return (
    <p
      className={`mt-3 rounded-control px-3.5 text-[0.85rem] leading-relaxed text-ink ${
        prominent ? "bg-surface py-3 shadow-card" : "bg-brand-soft py-2.5"
      }`}
    >
      <span className="font-semibold text-brand">Try this: </span>
      {action}
    </p>
  );
};
