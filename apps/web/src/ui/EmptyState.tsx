import type { ReactNode } from "react";

/**
 * Nothing to show, and that is a valid answer.
 *
 * Rendered on a `raised` ground rather than a dashed box: a dashed border is
 * the universal shorthand for "something is broken here", which is exactly the
 * wrong message when the app worked and the user simply has no data yet.
 */
export const EmptyState = ({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) => {
  return (
    <div className="rounded-card bg-raised px-6 py-10 text-center">
      <h3 className="font-display text-[1.05rem] font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-muted">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
};
