/**
 * The page header: whose dashboard this is, how much of their life it covers,
 * and whether the assistant is connected.
 *
 * The data range is stated rather than implied. "Last 90 days" is a claim
 * about what the reader is looking at, and a dashboard that hides it invites
 * people to read a three-month trend as a lifetime one.
 */

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  selectAssistant,
  selectAssistantConfigured,
  selectDataset,
  selectPayload,
} from "@/features/selectors";
import { opened } from "@/features/assistantSlice";
import { formatRange } from "@/lib/format";
import { useTheme } from "@/lib/useTheme";
import { Badge } from "@/ui/primitives";
import type { ThemeChoice } from "@/features/uiSlice";

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const ThemeToggle = () => {
  const { choice, theme, setChoice } = useTheme();

  return (
    <div
      className="flex items-center rounded-lg border border-line bg-surface p-0.5"
      role="group"
      aria-label="Colour theme"
    >
      {(Object.keys(THEME_LABEL) as ThemeChoice[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setChoice(option)}
          aria-pressed={choice === option}
          title={
            option === "system" ? `Following your system (${theme})` : `${THEME_LABEL[option]} theme`
          }
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
            choice === option ? "bg-brand text-white" : "text-muted hover:text-ink"
          }`}
        >
          {THEME_LABEL[option]}
        </button>
      ))}
    </div>
  );
};

export const TopBar = () => {
  const dispatch = useAppDispatch();
  const dataset = useAppSelector(selectDataset);
  const payload = useAppSelector(selectPayload);
  const configured = useAppSelector(selectAssistantConfigured);
  const { ungroundedTurns } = useAppSelector(selectAssistant);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 place-items-center rounded-lg bg-brand text-white"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12h3.5l2-5 3 10 2.5-7 1.5 2H21" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-none tracking-tight text-ink">
              Health Insight
            </h1>
            {dataset ? (
              <p className="mt-0.5 text-[11px] leading-none text-faint">
                {formatRange(dataset.range.start, dataset.range.end)} · {dataset.range.days} days
              </p>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {ungroundedTurns > 0 ? (
            <Badge tone="alert">
              {ungroundedTurns} unverified {ungroundedTurns === 1 ? "answer" : "answers"}
            </Badge>
          ) : null}

          <button
            type="button"
            onClick={() => dispatch(opened())}
            className="hidden rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition hover:text-ink sm:block"
          >
            {configured ? "Assistant connected" : "Assistant not configured"}
          </button>

          <ThemeToggle />

          {payload ? (
            <span className="hidden text-[11px] text-faint lg:block" title="Model serving the assistant">
              {payload.config.model} · {payload.config.effort}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
};
