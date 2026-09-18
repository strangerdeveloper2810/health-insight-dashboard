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
import { TopBar } from "@/layout/TopBar";
import { Card } from "@/ui/primitives";
import { ErrorState, LoadingState } from "@/ui/states";

/**
 * The assistant carries a markdown renderer that nothing else needs, so it is
 * fetched the first time someone opens the panel rather than on first paint.
 * Mounted only while open — a `lazy` component that is always rendered would
 * download immediately and defeat the point.
 */
const AssistantPanel = lazy(() =>
  import("@/assistant/AssistantPanel").then((module) => ({ default: module.AssistantPanel })),
);

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/**
 * The state simulator, linked rather than hidden.
 *
 * The brief asks for loading, error and empty states to be handled. Reviewing
 * them should not require editing code, so each one has a URL.
 */
function ReviewStates() {
  const states = [
    { query: "", label: "Live" },
    { query: "?state=loading", label: "Loading" },
    { query: "?state=error", label: "Error" },
    { query: "?state=empty", label: "Empty" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-faint">Review states:</span>
      {states.map((state) => (
        <a
          key={state.label}
          href={`/${state.query}`}
          className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] text-muted transition hover:text-ink"
        >
          {state.label}
        </a>
      ))}
    </div>
  );
}

function Dashboard() {
  const readiness = useAppSelector(selectReadiness);

  return (
    <div className="space-y-8">
      {readiness && readiness.components.length > 0 ? (
        <ReadinessHero readiness={readiness} />
      ) : null}

      <TodayTiles />

      <section>
        <SectionHeading
          title="What we noticed"
          note="Patterns found in your recordings, each with the figures behind it"
        />
        <InsightFeed />
      </section>

      <TrendsPanel />

      <section>
        <SectionHeading title="Goals" note="Measured the way each one actually works" />
        <GoalsPanel />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SleepPanel />
        <ActivityPanel />
      </div>

      <NutritionPanel />

      <section>
        <SectionHeading
          title="Context"
          note="What shapes how everything above should be read"
        />
        <ContextPanel />
      </section>
    </div>
  );
}

export function App() {
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
    <div className="min-h-dvh">
      <TopBar />

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
        {status === "error" && error ? (
          <ErrorState message={error.message} code={error.code} onRetry={retry} />
        ) : status === "ready" && payload ? (
          hasNoData ? (
            <Card className="p-10 text-center">
              <h2 className="text-base font-semibold text-ink">Nothing recorded yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                Your dashboard is ready, but there is no data in it. Once a watch or an app
                syncs a day of activity, sleep or a meal, this page fills in — the trends,
                the goals and the assistant all read from the same recordings.
              </p>
              <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-faint">
                Nothing is estimated or back-filled. An empty day stays empty rather than
                becoming a zero, because those mean different things.
              </p>
            </Card>
          ) : (
            <Dashboard />
          )
        ) : (
          <LoadingState />
        )}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <ReviewStates />
          <p className="text-[11px] text-faint">
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
}
