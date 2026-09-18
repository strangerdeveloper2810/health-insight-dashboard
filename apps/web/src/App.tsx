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
import { AssistantLauncher } from "@/features/assistant/components/AssistantLauncher";
import { ActivityPanel } from "@/features/dashboard/components/ActivityPanel";
import { ContextPanel } from "@/features/dashboard/components/ContextPanel";
import { GoalsPanel } from "@/features/dashboard/components/GoalsPanel";
import { InsightFeed } from "@/features/dashboard/components/InsightFeed";
import { NutritionPanel } from "@/features/dashboard/components/NutritionPanel";
import { ReadinessHero } from "@/features/dashboard/components/ReadinessHero";
import { SleepPanel } from "@/features/dashboard/components/SleepPanel";
import { TodayTiles } from "@/features/dashboard/components/TodayTiles";
import { TrendsPanel } from "@/features/dashboard/components/TrendsPanel";
import { loadDashboard, resetDashboard } from "@/features/dashboard/slice";
import { restoreChatHistory } from "@/features/assistant/slice";
import {
  selectAssistant,
  selectError,
  selectPayload,
  selectReadiness,
  selectStatus,
} from "@/features/selectors";
import { TopBar } from "@/features/layout/components/TopBar";
import { ToastContainer, toast } from "@/features/notification";
import { Section } from "@/shared/ui/Section";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";

/**
 * The markdown renderer is weight nothing else needs, so this is fetched on
 * first open rather than first paint — and mounted only while open, since an
 * always-rendered `lazy` component would download immediately.
 */
const AssistantPanel = lazy(() =>
  import("@/features/assistant/components/AssistantPanel").then((module) => ({ default: module.AssistantPanel })),
);

import { Tabs } from "@/shared/ui/Tabs";

const Dashboard = () => {
  const readiness = useAppSelector(selectReadiness);

  const overviewContent = (
    <div className="space-y-10">
      <section id="today" className="space-y-4">
        {readiness && readiness.components.length > 0 ? (
          <ReadinessHero readiness={readiness} />
        ) : null}
        <TodayTiles />
      </section>

      <Section id="noticed">
        <InsightFeed />
      </Section>
    </div>
  );

  const metricsContent = (
    <div className="space-y-10">
      <Section id="daily">
        <div className="grid gap-4 xl:grid-cols-2">
          <SleepPanel />
          <ActivityPanel />
        </div>
      </Section>

      <NutritionPanel />
    </div>
  );

  const trendsContent = (
    <div className="space-y-10">
      <TrendsPanel />

      <Section id="goals">
        <GoalsPanel />
      </Section>

      <Section id="context">
        <ContextPanel />
      </Section>
    </div>
  );

  return (
    <div className="mt-4">
      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: overviewContent },
          { id: "metrics", label: "Detailed Metrics", content: metricsContent },
          { id: "trends", label: "Trends & Goals", content: trendsContent },
        ]}
      />
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
    void dispatch(restoreChatHistory());
  }, [dispatch]);

  useEffect(() => {
    if (status === "error" && error) {
      toast.error("Dashboard Load Error", error.message);
    }
  }, [status, error]);

  const retry = () => {
    toast.info("Retrying", "Reloading dashboard data...");
    dispatch(resetDashboard());
    void dispatch(loadDashboard());
  };

  const hasNoData = payload !== null && payload.dataset.daily.length === 0;

  return (
    <div id="top" className="min-h-dvh">
      <TopBar />

      <main className="mx-auto max-w-[1400px] px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24">
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

      <AssistantLauncher />
      {assistantOpen ? (
        <Suspense fallback={null}>
          <AssistantPanel />
        </Suspense>
      ) : null}
      <ToastContainer />
    </div>
  );
};
