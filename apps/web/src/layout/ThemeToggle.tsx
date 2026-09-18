import { useTheme } from "@/lib/useTheme";
import type { ThemeChoice } from "@/features/uiSlice";

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/**
 * Three pills rather than a switch, because "follow the system" is a real third
 * state and a two-position control cannot express it — a reader whose laptop
 * switches at sunset would have to keep re-choosing.
 *
 * The active pill is `surface` on a `raised` track, so which one is selected is
 * legible without relying on the label alone. The tooltip on *System* names the
 * theme it is currently resolving to, which is the question that state raises.
 */
export const ThemeToggle = () => {
  const { choice, theme, setChoice } = useTheme();

  return (
    <div
      className="flex items-center rounded-full bg-raised p-0.5"
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
          className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium leading-none transition ${
            choice === option ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
          }`}
        >
          {THEME_LABEL[option]}
        </button>
      ))}
    </div>
  );
};
