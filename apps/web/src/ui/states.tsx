/**
 * Loading, error and empty states.
 *
 * The brief asks for all three, and the distinction that matters is between
 * the last two. An error says the app could not do its job. An empty state
 * says the app did its job and the answer is "there is nothing here yet" —
 * which for a health dashboard is a normal first day, not a failure. Showing
 * an error for the second case teaches people to distrust the screen.
 *
 * All three are reachable in a browser via `?state=`, so they can be reviewed
 * without unplugging anything.
 */

import type { ReactNode } from "react";

import { Card } from "./primitives";

export const Skeleton = ({ className = "" }: { className?: string }) => {
  return (
    <div
      className={`animate-pulse rounded-md bg-raised ${className}`}
      // Announced once by the container, not per element.
      aria-hidden
    />
  );
};

export const LoadingState = ({ label = "Loading your dashboard" }: { label?: string }) => {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Card className="p-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Skeleton className="size-[132px] shrink-0 rounded-full" />
          <div className="w-full space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((column) => (
          <Card key={column} className="space-y-3 p-5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );
};

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
    <Card className="p-8 text-center">
      <div
        className="mx-auto grid size-11 place-items-center rounded-full bg-alert-soft text-alert"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
          <path d="M12 3.5 21 20H3z" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{message}</p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Try again
        </button>
      ) : null}

      {code ? <p className="mt-4 text-[11px] text-faint">Reference: {code}</p> : null}
    </Card>
  );
};

export const EmptyState = ({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line bg-raised px-6 py-10 text-center">
      {icon ? <div className="text-faint">{icon}</div> : null}
      <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};

/**
 * A caveat attached to real data.
 *
 * Distinct from an empty state: there *is* data here, it is just not complete
 * enough to read the way it looks. Nutrition logging in this dataset runs
 * around 70% of days, which turns every average into an undercount — and an
 * unlabelled undercount is worse than no number.
 */
export const CaveatNote = ({ children }: { children: ReactNode }) => {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-watch/25 bg-watch-soft px-3 py-2 text-xs leading-relaxed text-watch">
      <svg
        viewBox="0 0 24 24"
        className="mt-px size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      <span>{children}</span>
    </p>
  );
};
