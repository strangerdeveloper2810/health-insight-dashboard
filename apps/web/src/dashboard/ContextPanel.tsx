/**
 * The context that changes how every other number should be read.
 *
 * A resting heart rate of 58 is unremarkable for a runner and worth a
 * conversation for someone on a beta blocker. Without this panel the rest of
 * the dashboard is a set of numbers with no interpretation attached, and the
 * assistant is answering questions about a stranger. It is also shown here,
 * not just fed to the model, so the user can see exactly what the assistant
 * has been told about them — a profile the model reads but the user cannot is
 * a profile that will eventually surprise them.
 */

import type { DataQualityNote } from "@health/core";

import { useAppSelector } from "@/app/hooks";
import { selectDataset } from "@/features/selectors";
import { Badge, Card, Panel } from "@/ui/primitives";
import { EmptyState } from "@/ui/states";

const List = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-faint">{title}</h3>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item}>
            <Badge tone="muted" className="font-normal">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};

const QualityRow = ({ note }: { note: DataQualityNote }) => {
  const pct = Math.round(note.completeness * 100);
  const tone = pct >= 85 ? "positive" : pct >= 60 ? "watch" : "alert";

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink">{note.scope}</span>
        <Badge tone={tone}>{pct}%</Badge>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{note.note}</p>
    </li>
  );
};

export const ContextPanel = () => {
  const dataset = useAppSelector(selectDataset);
  const persona = dataset?.persona ?? null;

  if (!persona) {
    return (
      <Card className="p-5">
        <EmptyState
          title="No profile yet"
          message="Once a profile exists, this is where the context that shapes how your numbers should be read will live."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Your context" subtitle="What the assistant is told about you">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-faint">Age</p>
              <p className="font-medium text-ink">{persona.age}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-faint">Height</p>
              <p className="font-medium text-ink">{persona.heightCm} cm</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wide text-faint">Occupation</p>
              <p className="font-medium text-ink">{persona.occupation}</p>
            </div>
          </div>

          <List title="In their own words" items={persona.subjectiveNotes} />
          <List title="Risk factors" items={persona.riskFactors} />
          <List title="Conditions" items={persona.conditions} />
          <List title="Medications" items={persona.medications} />

          <div className="rounded-lg border border-brand/20 bg-brand-soft px-3 py-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-brand">
              Clinician guidance
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink">{persona.clinicianGuidance}</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="How complete this data is"
        subtitle="Where the numbers above are thinner than they look"
      >
        {dataset && dataset.dataQuality.length > 0 ? (
          <ul className="divide-y divide-line">
            {dataset.dataQuality.map((note) => (
              <QualityRow key={note.scope} note={note} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing recorded yet"
            message="Data quality notes appear here once there are recordings to assess — which days are covered, and which are missing."
          />
        )}
      </Panel>
    </div>
  );
};
