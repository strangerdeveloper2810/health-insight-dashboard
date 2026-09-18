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
 *
 * Each state lives in its own file; this barrel re-exports them so call sites
 * keep importing from `@/ui/states`.
 */

export { CaveatNote } from "./CaveatNote";
export { EmptyState } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export { LoadingState } from "./LoadingState";
export { Skeleton } from "./Skeleton";
