/**
 * Opens the working.
 *
 * The label changes with the state rather than staying fixed, so the button
 * always says what pressing it will do next rather than what it did last time.
 * `aria-expanded` carries the same information to a screen reader, which
 * cannot see the label swap happen.
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
