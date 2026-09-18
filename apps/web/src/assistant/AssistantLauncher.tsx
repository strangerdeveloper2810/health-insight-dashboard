/**
 * The launcher button.
 *
 * Deliberately its own file, and deliberately empty of dependencies. The panel
 * behind it pulls in a markdown renderer, which is weight nobody should pay for
 * until they actually open the assistant — so this stays small enough to ship
 * in the initial bundle and the panel arrives on demand.
 */

import { useAppDispatch } from "@/app/hooks";
import { opened } from "@/features/assistantSlice";

export const AssistantLauncher = () => {
  const dispatch = useAppDispatch();

  return (
    <button
      type="button"
      onClick={() => dispatch(opened())}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-90"
      aria-label="Open the health assistant"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        aria-hidden
      >
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
      </svg>
      Ask about your health
    </button>
  );
};
