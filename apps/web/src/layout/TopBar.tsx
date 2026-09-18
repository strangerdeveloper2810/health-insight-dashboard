/**
 * The masthead: whose dashboard this is, how to get anywhere in it, and
 * whether the assistant is connected.
 *
 * The date range is not here. It moved into the hero, because it is a claim
 * about what the reader is looking at and so belongs beside the headline it
 * qualifies — pinned to the chrome it competes with the controls for attention
 * while telling the reader nothing they can act on.
 *
 * This file is composition only; the rail and the theme control each live in
 * their own module.
 */

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectAssistant, selectAssistantConfigured } from "@/features/selectors";
import { opened } from "@/features/assistantSlice";
import { Badge, Dot } from "@/ui/primitives";
import { SectionRail } from "./SectionRail";
import { ThemeToggle } from "./ThemeToggle";

export const TopBar = () => {
  const dispatch = useAppDispatch();
  const configured = useAppSelector(selectAssistantConfigured);
  const { ungroundedTurns } = useAppSelector(selectAssistant);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-center gap-3 pt-2.5">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-brand text-brand-ink"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.1}>
                <path
                  d="M3 12h3.5l2-5 3 10 2.5-7 1.5 2H21"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="truncate font-display text-[1.05rem] font-semibold leading-none tracking-[-0.015em] text-ink">
              Health Insight
            </span>
          </a>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {ungroundedTurns > 0 ? (
              <Badge tone="alert">
                {ungroundedTurns} unverified {ungroundedTurns === 1 ? "answer" : "answers"}
              </Badge>
            ) : null}

            <button
              type="button"
              onClick={() => dispatch(opened())}
              className="hidden items-center gap-1.5 rounded-full bg-raised px-2.5 py-1 text-[0.72rem] font-medium leading-none text-muted transition hover:text-ink sm:inline-flex"
            >
              <Dot tone={configured ? "positive" : "muted"} />
              {configured ? "Assistant ready" : "Assistant off"}
            </button>

            <ThemeToggle />
          </div>
        </div>

        <SectionRail />
      </div>
    </header>
  );
};
