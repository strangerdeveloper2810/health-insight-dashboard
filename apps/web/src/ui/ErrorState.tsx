import { Card } from "./Card";

/**
 * The app could not do its job.
 *
 * Distinct from an empty state, which says the app did its job and the answer
 * is "there is nothing here yet". Showing this for that case teaches people to
 * distrust the screen, so the two never share a component.
 */
export const ErrorState = ({
  title = "We could not load your dashboard",
  message,
  code,
  onRetry,
}: {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}) => {
  return (
    <Card className="px-6 py-12 text-center">
      <div
        className="mx-auto grid size-12 place-items-center rounded-full bg-alert-soft text-alert"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
          <path d="M12 3.5 21 20H3z" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="mt-4 font-display text-[1.35rem] font-semibold tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[0.9rem] leading-relaxed text-muted">{message}</p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full bg-brand px-5 py-2.5 text-[0.85rem] font-semibold text-brand-ink transition hover:opacity-90"
        >
          Try again
        </button>
      ) : null}

      {code ? <p className="mt-5 text-[0.72rem] text-faint">Reference: {code}</p> : null}
    </Card>
  );
};
