/**
 * Resolving the theme to one concrete value.
 *
 * Three inputs decide what the page looks like — an explicit choice, the OS
 * preference, and the DOM class the CSS reads — and they have to agree. The
 * chart palette is chosen in JavaScript, so a `.dark` class that disagreed
 * with Redux would give a dark page with light-mode gridlines. Resolving to a
 * single `theme` field in the store and driving the class from it removes the
 * chance of that.
 */

import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectUi } from "@/features/selectors";
import { themeChosen, themeResolved } from "@/features/uiSlice";
import type { ThemeChoice } from "@/features/uiSlice";

const STORAGE_KEY = "health-dashboard.theme";
const QUERY = "(prefers-color-scheme: dark)";

function isChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

function readStored(): ThemeChoice | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(raw) ? raw : null;
  } catch {
    // Private windows and blocked site data throw on access. A missing
    // preference is not an error worth surfacing.
    return null;
  }
}

export function useTheme() {
  const dispatch = useAppDispatch();
  const choice = useAppSelector(selectUi).themeChoice;
  const theme = useAppSelector(selectUi).theme;

  // Restore the stored choice once, after mount — reading localStorage during
  // module init would run before the store exists.
  useEffect(() => {
    const stored = readStored();
    if (stored && stored !== choice) dispatch(themeChosen(stored));
    // Intentionally once: later changes write, they do not read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const apply = () => {
      const resolved = choice === "system" ? (media.matches ? "dark" : "light") : choice;
      dispatch(themeResolved(resolved));
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    apply();
    if (choice !== "system") return;

    // Following the OS means following it while the page is open, not only at
    // load — a machine that switches at sunset should take the page with it.
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [choice, dispatch]);

  const setChoice = (next: ThemeChoice) => {
    dispatch(themeChosen(next));
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is survivable.
    }
  };

  return { choice, theme, setChoice };
}
