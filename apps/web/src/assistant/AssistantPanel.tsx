/**
 * The assistant panel. Every answer ends with a verdict on whether its
 * citations resolved — when one did not, the panel says so rather than letting
 * a confident sentence stand unqualified.
 *
 * The disclaimer is not boilerplate: an assistant that answers "what should I
 * focus on?" in a warm, certain voice will be read as advice, and must not be
 * mistaken for a clinician.
 */

import { useEffect, useRef, useState } from "react";
import { SUGGESTED_QUESTIONS } from "@health/core";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  selectAssistant,
  selectAssistantConfigured,
  selectPayload,
  selectRefIndex,
} from "@/features/selectors";
import {
  closed,
  resetConversation,
  sendMessage,
  stopStreaming,
} from "@/features/assistantSlice";
import type { AssistantMessage } from "@/features/assistantSlice";
import { Badge } from "@/ui/primitives";

import { MarkdownAnswer } from "./GroundedText";

// ─── Pieces ─────────────────────────────────────────────────────────────────

const GroundingBadge = ({ message }: { message: AssistantMessage }) => {
  if (!message.grounding) return null;
  const { grounded, cited, unknown } = message.grounding;

  if (grounded) {
    return (
      <p className="mt-1.5 text-[0.72rem] text-faint">
        {cited.length > 0
          ? `Every figure checked against your data · ${cited.length} citation${cited.length === 1 ? "" : "s"}`
          : "No figures were cited"}
      </p>
    );
  }

  return (
    <p className="mt-2 rounded-control bg-alert-soft px-2.5 py-1.5 text-[0.75rem] leading-relaxed text-alert">
      <span className="font-semibold">Not fully verified. </span>
      {unknown.length === 1 ? "One value" : `${unknown.length} values`} in this answer could not
      be matched to your recorded data ({unknown.join(", ")}). Everything else was checked.
    </p>
  );
};

const ToolTrace = ({ tools }: { tools: string[] }) => {
  if (tools.length === 0) return null;
  const LABEL: Record<string, string> = {
    get_metric_series: "Read your metric history",
    compare_periods: "Compared two periods",
    get_sleep_breakdown: "Read your sleep detail",
    get_workouts: "Read your training sessions",
  };

  return (
    <ul className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <li key={tool}>
          <Badge tone="info" className="font-normal">
            {LABEL[tool] ?? tool}
          </Badge>
        </li>
      ))}
    </ul>
  );
};

const Bubble = ({ message }: { message: AssistantMessage }) => {
  const index = useAppSelector(selectRefIndex);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm leading-relaxed text-brand-ink">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-raised px-3.5 py-2.5">
        <ToolTrace tools={message.tools ?? []} />

        {message.status === "error" ? (
          <p className="text-sm leading-relaxed text-alert">{message.error?.message}</p>
        ) : (
          <div className={message.status === "streaming" ? "stream-caret" : undefined}>
            <MarkdownAnswer text={message.content} index={index} />
          </div>
        )}

        <GroundingBadge message={message} />
      </div>
    </div>
  );
};

const SuggestedChips = ({ onPick }: { onPick: (question: string) => void }) => {
  return (
    <div className="px-3.5 pb-1">
      <p className="mb-2 text-[0.75rem] text-faint">
        Ask about anything on the dashboard. Answers are drawn from your own recordings.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="rounded-full bg-raised px-2.5 py-1 text-[0.75rem] text-muted transition hover:bg-brand-soft hover:text-brand"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Panel ──────────────────────────────────────────────────────────────────

export const AssistantPanel = () => {
  const dispatch = useAppDispatch();
  const assistant = useAppSelector(selectAssistant);
  const configured = useAppSelector(selectAssistantConfigured);
  const payload = useAppSelector(selectPayload);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Follow the answer as it streams. `messages` identity changes on every
  // delta, so this runs on each token — which is what keeps the newest line
  // in view.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [assistant.messages]);

  useEffect(() => {
    if (!assistant.open) return;
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch(closed());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistant.open, dispatch]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || assistant.streaming) return;
    setDraft("");
    void dispatch(sendMessage(trimmed));
  };

  // The launcher lives in its own module so it can ship without this one; this
  // component is only mounted once the panel is actually open.
  if (!assistant.open) return null;

  return (
    <section
      role="dialog"
      aria-label="Health assistant"
      className="animate-slide-in fixed inset-x-0 bottom-0 z-40 flex h-[85vh] flex-col overflow-hidden rounded-t-tile bg-surface shadow-float sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,82vh)] sm:w-[420px] sm:rounded-tile"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.015em] text-ink">
            Health assistant
          </h2>
          <p className="truncate text-[0.75rem] text-faint">
            {payload
              ? `Reading your ${payload.config.datasetDays} days of data · ${payload.config.model}`
              : "Waiting for your dashboard"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {assistant.messages.length > 0 ? (
            <button
              type="button"
              onClick={() => dispatch(resetConversation())}
              className="rounded-control px-2 py-1 text-[0.78rem] text-muted transition hover:bg-raised hover:text-ink"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dispatch(closed())}
            aria-label="Close the assistant"
            className="rounded-control p-1.5 text-muted transition hover:bg-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* The message list's caret only appears once the first token lands; this
          covers the gap between pressing Send and hearing anything back. */}
      {assistant.streaming ? (
        <div className="relative h-0.5 w-full overflow-hidden bg-brand-soft" aria-hidden>
          <span className="animate-sweep absolute inset-y-0 w-1/3 rounded-full bg-brand" />
        </div>
      ) : null}

      {/* One polite announcement per state change. Putting aria-live on the
          message list itself would read every token aloud. */}
      <p className="sr-only" role="status" aria-live="polite">
        {assistant.streaming
          ? "The assistant is responding."
          : assistant.messages.length > 0
            ? "The assistant has finished responding."
            : ""}
      </p>

      <div ref={scrollRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
        {assistant.messages.length === 0 ? (
          <div className="rounded-control bg-raised p-3.5">
            <p className="text-xs leading-relaxed text-muted">
              I can explain what your dashboard is showing, compare periods, and point at what
              has changed. I only see the recordings in this dashboard — I cannot see anything
              you have not logged, and I will say so rather than guess.
            </p>
          </div>
        ) : (
          assistant.messages.map((message) => <Bubble key={message.id} message={message} />)
        )}
      </div>

      {assistant.messages.length === 0 ? (
        <SuggestedChips onPick={submit} />
      ) : null}

      <footer className="border-t border-line p-3">
        {!configured ? (
          <p className="rounded-control bg-watch-soft px-3 py-2 text-[0.75rem] leading-relaxed text-watch">
            The assistant is not connected on this server. Set{" "}
            <code className="font-mono">ANTHROPIC_API_KEY</code> and restart the BFF. Everything
            else on the dashboard works without it.
          </p>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
              className="flex items-end gap-2"
            >
              <label className="sr-only" htmlFor="assistant-input">
                Ask the health assistant a question
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter is a newline. A chat box that
                  // cannot hold a paragraph is a chat box people stop using.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(draft);
                  }
                }}
                rows={1}
                placeholder="How am I progressing?"
                className="scroll-slim max-h-32 min-h-[38px] flex-1 resize-none rounded-control bg-raised px-3 py-2 text-sm text-ink placeholder:text-faint focus:ring-2 focus:ring-brand/40 focus:outline-none"
              />

              {assistant.streaming ? (
                <button
                  type="button"
                  onClick={() => void dispatch(stopStreaming())}
                  className="h-[38px] shrink-0 rounded-control bg-raised px-3 text-[0.78rem] font-medium text-muted transition hover:text-ink"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={draft.trim().length === 0}
                  className="h-[38px] shrink-0 rounded-control bg-brand px-3.5 text-sm font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-40"
                >
                  Send
                </button>
              )}
            </form>

            <p className="mt-2 text-[0.72rem] leading-relaxed text-faint">
              Not medical advice. This assistant summarises your own recordings and cannot
              diagnose anything — for symptoms or medication changes, talk to your clinician.
            </p>
          </>
        )}
      </footer>
    </section>
  );
};
