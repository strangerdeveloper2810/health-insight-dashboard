import { useAppSelector } from "@/app/hooks";
import { selectPayload } from "@/features/selectors";

/**
 * The state simulator: each of loading, error and empty has a `?state=` URL so
 * a reviewer can reach it without editing code or unplugging the network.
 *
 * `slice(0, 10)` on the ISO timestamp is deliberate — the reviewer needs to see
 * *which* build produced what they are looking at, not the milliseconds.
 */
const STATES = [
  { query: "", label: "Live" },
  { query: "?state=loading", label: "Loading" },
  { query: "?state=error", label: "Error" },
  { query: "?state=empty", label: "Empty" },
];

export const ReviewStates = () => {
  const payload = useAppSelector(selectPayload);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.72rem] text-faint">Review states:</span>
      {STATES.map((state) => (
        <a
          key={state.label}
          href={`/${state.query}`}
          className="rounded-full bg-raised px-2.5 py-1 text-[0.72rem] font-medium text-muted transition hover:text-ink"
        >
          {state.label}
        </a>
      ))}
      {payload ? (
        <span className="text-[0.72rem] text-faint">
          {payload.config.model} · {payload.config.effort} ·{" "}
          {payload.dataset.generatedAt.slice(0, 10)}
        </span>
      ) : null}
    </div>
  );
};
