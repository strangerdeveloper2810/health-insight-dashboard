/**
 * Page composition — readiness and today's numbers first, then what we noticed,
 * trends, goals, the per-domain detail, and context.
 *
 * Everything from "noticed" down is wrapped in `<Section>`, which takes its
 * number and title from `lib/sections` — the same list the masthead rail
 * navigates by. The hero is not: a numbered heading above the verdict would
 * push it below the fold, so the hero carries the `today` anchor itself.
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
 * The markdown renderer is weight nothing else needs, so this is fetched on
 * first open rather than first paint — and mounted only while open, since an
 * always-rendered `lazy` component would download immediately.
 */
const AssistantPanel = lazy(() =>
  import("@/assistant/AssistantPanel").then((module) => ({ default: module.AssistantPanel })),
);

const Dashboard = () => {
  const readiness = useAppSelector(selectReadiness);

  return (
    <div className="space-y-10">
      {/* No heading: an `01 Today` above the verdict would push it off the
          first screen. The rail still links here, which is what the anchor is
          for. */}
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
