import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

/**
 * The dashboard, before it arrives. The skeleton mirrors the real layout rather
 * than being a generic grey block, so the page settles into place instead of
 * jumping.
 */
export const LoadingState = ({ label = "Loading your dashboard" }: { label?: string }) => {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      <Card className="p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:gap-8">
          <Skeleton className="size-[118px] shrink-0 rounded-full sm:size-[168px]" />
          <div className="w-full space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
        <Skeleton className="mt-6 h-32 w-full rounded-tile" />
        <div className="mt-6 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
          {[0, 1, 2].map((column) => (
            <div key={column} className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((cell) => (
          <div key={cell} className="space-y-3 bg-surface p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
};
