/**
 * Page composition.
 *
 * The order is the product argument, top to bottom:
 *
 *   1. Readiness, then what produced it      — how am I, and why
 *   2. Today's four numbers                  — the facts underneath it
 *   3. What we noticed                       — what is worth acting on
 *   4. Trends                                — is this changing
 *   5. Goals                                 — am I on track
 *   6. Sleep, activity, nutrition            — the detail, by domain
 *   7. Context and data quality              — what to keep in mind reading any of it
 *
 * Anything that would go above the readiness score had to justify being more
 * important than "how am I today", and nothing did.
 *
 * Sections 3 onwards are wrapped in `<Section>`, which takes its number, its
 * title and its note from `lib/sections` — the same list the masthead rail
 * navigates by. Section 1 is not: a numbered heading above the verdict would
 * push the one thing the reader came for below the fold, so the hero carries
 * the `today` anchor itself and its headline is its heading.
 */

import { lazy, Suspense, useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { AssistantLauncher } from "@/assistant/AssistantLauncher";
import { ActivityPanel } from "@/dashboard/ActivityPanel";
import { ContextPanel } from "@/dashboard/ContextPanel";
import { GoalsPanel } from "@/dashboard/GoalsPanel";
import { InsightFeed } from "@/dashboard/InsightFeed";
import { NutritionPanel } from "@/dashboard/NutritionPanel";
import { ReadinessHero } from "@/dashboard/ReadinessHero";
import { SleepPanel } from "@/dashboard/SleepPanel";
import { TodayTiles } from "@/dashboard/TodayTiles";
import { TrendsPanel } from "@/dashboard/TrendsPanel";
import { loadDashboard, resetDashboard } from "@/features/dashboardSlice";
import {
  selectAssistant,
  selectError,
  selectPayload,
  selectReadiness,
  selectStatus,
} from "@/features/selectors";
import { ReviewStates } from "@/layout/ReviewStates";
import { TopBar } from "@/layout/TopBar";
import { Section } from "@/ui/Section";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";

/**
 * The assistant carries a markdown renderer that nothing else needs, so it is
 * fetched the first time someone opens the panel rather than on first paint.
 * Mounted only while open — a `lazy` component that is always rendered would
 * download immediately and defeat the point.
 */
const AssistantPanel = lazy(() =>
  import("@/assistant/AssistantPanel").then((module) => ({ default: module.AssistantPanel })),
);

const Dashboard = () => {
  const readiness = useAppSelector(selectReadiness);

  return (
    <div className="space-y-10">
      {/* No heading: the hero's own headline is this section's title, and an
          `01 Today` above it would push the verdict off the first screen. The
          rail still links here, which is what the anchor is for. */}
      <section id="today" className="scroll-mt-28 space-y-4">
        {readiness && readiness.components.length > 0 ? (
          <ReadinessHero readiness={readiness} />
        ) : null}
        <TodayTiles />
      </section>

      <Section id="noticed">
        <InsightFeed />
      </Section>

      {/* A single-panel section carries its own heading, so it is not wrapped:
          a `<Section>` here would print "Trends" twice, once as the section and
          once as the card. */}
      <TrendsPanel />

      <Section id="goals">
        <GoalsPanel />
      </Section>

      <Section id="daily">
        <div className="grid gap-4 xl:grid-cols-2">
          <SleepPanel />
          <ActivityPanel />
        </div>
      </Section>

      <NutritionPanel />

      <Section id="context">
        <ContextPanel />
      </Section>
    </div>
  );
};

export const App = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const payload = useAppSelector(selectPayload);
  const error = useAppSelector(selectError);
  const assistantOpen = useAppSelector(selectAssistant).open;

  useEffect(() => {
    void dispatch(loadDashboard());
  }, [dispatch]);

  const retry = () => {
    dispatch(resetDashboard());
    void dispatch(loadDashboard());
  };

  const hasNoData = payload !== null && payload.dataset.daily.length === 0;

  return (
    <div id="top" className="min-h-dvh">
      <TopBar />

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
        {status === "error" && error ? (
          <ErrorState message={error.message} code={error.code} onRetry={retry} />
        ) : status === "ready" && payload ? (
          hasNoData ? (
            <EmptyState
              title="Nothing recorded yet"
              message="Your dashboard is ready, but there is no data in it. Once a watch or an app syncs a day of activity, sleep or a meal, this page fills in — the trends, the goals and the assistant all read from the same recordings. Nothing is estimated or back-filled: an empty day stays empty rather than becoming a zero, because those mean different things."
            />
          ) : (
            <Dashboard />
          )
        ) : (
          <LoadingState />
        )}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-4">
          <ReviewStates />
          <p className="text-[0.72rem] text-faint">
            Generated data for a fictional persona · not medical advice
          </p>
        </div>
      </footer>

      <AssistantLauncher />
      {assistantOpen ? (
        <Suspense fallback={null}>
          <AssistantPanel />
        </Suspense>
      ) : null}
    </div>
  );
};
