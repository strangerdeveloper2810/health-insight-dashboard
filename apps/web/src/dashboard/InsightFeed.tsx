/**
 * "What we noticed" — the part of the dashboard that has an opinion.
 *
 * Every card can show its work. Pressing *Why this?* reveals the rule that
 * fired and the exact figures it read, each one a reference from the same
 * index the assistant cites. That is the difference between a dashboard that
 * tells you something and one that asks to be trusted.
 *
 * The suggested action is deliberately specific — "move lights-out twenty
 * minutes earlier on weeknights", not "improve your sleep". Generic advice is
 * indistinguishable from a horoscope, and the rules that produce these cards
 * know enough to be concrete.
 */

import { formatEvidenceValue } from "@health/core";
import type { Insight, InsightSeverity } from "@health/core";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectInsights, selectUi } from "@/features/selectors";
import { insightToggled } from "@/features/uiSlice";
import { SEVERITY_STYLE } from "@/lib/theme";
import { Badge, Card } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";

const ORDER: InsightSeverity[] = ["alert", "watch", "positive", "info"];

const InsightCard = ({ insight }: { insight: Insight }) => {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectUi).openInsight === insight.id;
  const style = SEVERITY_STYLE[insight.severity];

  return (
    <Card className="animate-rise p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${style.chip} rounded-full border px-2 py-0.5`}>
          <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
          {style.label}
        </span>
      </div>

      <h3 className="mt-2.5 text-sm font-semibold leading-snug text-ink">{insight.title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{insight.body}</p>

      <p className="mt-3 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 text-xs leading-relaxed text-ink">
        <span className="font-semibold text-brand">Try this: </span>
        {insight.action}
      </p>

      {insight.caveat ? (
        <p className="mt-2 text-[11px] leading-relaxed text-watch">{insight.caveat}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {insight.evidence.map((ref) => (
          <Badge key={ref.ref} tone="muted" className="font-normal">
            <span className="text-faint">{ref.label}</span>
            <span className="font-medium text-ink">{formatEvidenceValue(ref)}</span>
          </Badge>
        ))}
      </div>

      <button
        type="button"
        onClick={() => dispatch(insightToggled(insight.id))}
        aria-expanded={open}
        className="mt-3 text-[11px] font-medium text-brand underline-offset-2 hover:underline"
      >
        {open ? "Hide the working" : "Why this?"}
      </button>

      {open ? (
        <dl className="mt-2.5 space-y-1.5 rounded-lg border border-line bg-raised px-3 py-2.5 text-[11px]">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-faint">Rule</dt>
            <dd className="font-mono text-muted">{insight.rule}</dd>
          </div>
          {insight.evidence.map((ref) => (
            <div key={ref.ref} className="flex gap-2">
              <dt className="w-20 shrink-0 truncate font-mono text-faint" title={ref.ref}>
                {ref.ref}
              </dt>
              <dd className="text-muted">
                {formatEvidenceValue(ref)} — {ref.label}
              </dd>
            </div>
          ))}
          <div className="flex gap-2 border-t border-line pt-1.5">
            <dt className="w-20 shrink-0 text-faint">Source</dt>
            <dd className="text-muted">
              Computed from your own recordings. The assistant can cite these same values, and
              cannot state a number that is not among them.
            </dd>
          </div>
        </dl>
      ) : null}
    </Card>
  );
};

export const InsightFeed = () => {
  const insights = useAppSelector(selectInsights);

  const sorted = [...insights].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Nothing stands out yet"
        message="Your patterns get more interesting as more days accumulate. Once there is a fortnight of consistent data, this is where anything worth your attention will appear."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sorted.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
};
