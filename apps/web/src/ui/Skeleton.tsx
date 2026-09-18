/** A placeholder block, sized by the caller to match what will replace it. */
export const Skeleton = ({ className = "" }: { className?: string }) => {
  return (
    <div
      className={`animate-pulse rounded-control bg-raised ${className}`}
      // Announced once by the container, not per element.
      aria-hidden
    />
  );
};
