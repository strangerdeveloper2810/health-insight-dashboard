import type { Insight } from "@health/core";

/**
 * The one thing to do about it.
 *
 * Raised above the body text rather than set in the same paragraph, because it
 * is the only line on the card the reader is meant to *do* something with.
 * Everything else describes; this instructs.
 *
 * `prominent` lifts it onto its own surface with a shadow. The focus card uses
 * it — that card sits on a `raised` ground, so a `brand-soft` block would read
 * as another chip rather than as the answer. The feed cards sit on `surface`,
 * where the tint alone is enough.
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
