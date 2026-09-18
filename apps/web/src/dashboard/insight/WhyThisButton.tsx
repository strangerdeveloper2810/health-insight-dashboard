/**
 * Opens the working. The label names what pressing it will do next rather than
 * what it did last time, with `aria-expanded` carrying the same state to a screen
 * reader that cannot see the label swap.
 */
export const WhyThisButton = ({
  open,
  onToggle,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`text-[0.78rem] font-medium text-brand underline-offset-2 hover:underline ${className}`}
    >
      {open ? "Hide the working" : "Why this?"}
    </button>
  );
};
