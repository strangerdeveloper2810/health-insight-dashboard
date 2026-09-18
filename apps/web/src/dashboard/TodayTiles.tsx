/**
 * Today, in four numbers, read from the precomputed series and summary windows
 * rather than re-derived from the daily records — the server already decided what
 * "latest sleep duration" means, including which nights are gaps.
 */

import type { MetricKey } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectPayload } from "@/features/selectors";
import { Card } from "@/ui/primitives";
import { MetricTile } from "./today/MetricTile";

const TILES: MetricKey[] = ["steps", "sleepDurationMin", "restingHeartRate", "hrvMs"];

export const TodayTiles = () => {
  const payload = useAppSelector(selectPayload);
  if (!payload) return null;

  // With no history at all the tiles would be four cells reading "not recorded",
  // which is worse than saying it once.
  const hasAnySeries = TILES.some((metric) => (payload.series[metric]?.length ?? 0) > 0);
  if (!hasAnySeries) {
    return (
      <Card className="p-6">
        <h3 className="font-display text-[1.05rem] font-semibold text-ink">Your recent numbers</h3>
        <p className="mt-1.5 max-w-lg text-[0.85rem] leading-relaxed text-muted">
          Nothing has been recorded yet. Once your watch syncs a day or two of data, this row
          fills in with your latest reading for each metric and how it compares with the week
          before.
        </p>
      </Card>
    );
  }

  return (
    // gap-px over bg-line: the hairline is the grid showing through, so no cell
    // needs its own border.
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        {TILES.map((metric) => (
          <MetricTile key={metric} metric={metric} />
        ))}
      </div>
    </Card>
  );
};
