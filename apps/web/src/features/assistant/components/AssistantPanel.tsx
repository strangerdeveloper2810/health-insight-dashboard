/**
 * The assistant panel with multi-session chat support.
 * Allows users to create new sessions, switch between previous conversations,
 * and delete individual sessions safely without losing history.
 */

import { useEffect, useRef, useState } from "react";
import { SUGGESTED_QUESTIONS } from "@health/core";
import { ArrowLeft, History, Plus, Trash2 } from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  selectActiveSession,
  selectAssistant,
  selectAssistantConfigured,
  selectPayload,
  selectRefIndex,
} from "@/features/selectors";
import {
  clearAllSessions,
  closed,
  createNewSession,
  deleteSession,
  resetConversation,
  restoreChatHistory,
  sendMessage,
  stopStreaming,
  switchSession,
} from "@/features/assistant/slice";
import type { AssistantMessage, ChatSession } from "@/features/assistant/slice";
import { Badge } from "@/shared/ui/primitives";
import { toast } from "@/features/notification";

import { MarkdownAnswer } from "./GroundedText";

// ─── Formatting helpers ──────────────────────────────────────────────────────

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

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

const Bubble = ({ message, onOptionClick }: { message: AssistantMessage; onOptionClick: (q: string) => void }) => {
  const index = useAppSelector(selectRefIndex);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 mb-4">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-sm bg-brand px-4 py-2.5 text-[0.9rem] leading-relaxed text-brand-ink shadow-sm">
          {message.content}
        </p>
        <div className="size-8 rounded-full bg-raised flex items-center justify-center shrink-0 shadow-sm border border-line">
          <svg className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-3 mb-4">
      <div className="size-8 rounded-full bg-brand flex items-center justify-center shrink-0 shadow-sm">
        <svg className="size-4 text-brand-ink" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </div>
      <div className="max-w-[85%] rounded-[20px] rounded-bl-sm bg-surface border border-line px-4 py-3 shadow-sm">
        <ToolTrace tools={message.tools ?? []} />

        {message.status === "error" ? (
          <p className="text-[0.9rem] leading-relaxed text-alert font-medium">{message.error?.message}</p>
        ) : (
          <div className={message.status === "streaming" ? "stream-caret text-[0.9rem]" : "text-[0.9rem]"}>
            <MarkdownAnswer text={message.content} index={index} onOptionClick={onOptionClick} />
          </div>
        )}

        <GroundingBadge message={message} />
      </div>
    </div>
  );
};

const SuggestedChips = ({ onPick }: { onPick: (question: string) => void }) => {
  return (
    <div className="px-4 pb-2">
      <p className="mb-3 text-[0.78rem] text-muted">
        Ask about anything on the dashboard. Answers are drawn from your own recordings.
      </p>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="rounded-full bg-surface border border-line px-3.5 py-1.5 text-[0.8rem] font-medium text-ink transition hover:bg-raised shadow-sm"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Sessions Drawer / History View ─────────────────────────────────────────

interface SessionsListProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onClearAll: () => void;
  onCloseHistory: () => void;
}

const SessionsList = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onClearAll,
  onCloseHistory,
}: SessionsListProps) => {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseHistory}
            className="rounded-control p-1 text-muted transition hover:bg-raised hover:text-ink"
            aria-label="Back to active chat"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h3 className="text-sm font-semibold text-ink">Conversations</h3>
          <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
            {sessions.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onNewSession}
          className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-ink transition hover:opacity-90 shadow-sm"
        >
          <Plus className="size-3.5" />
          New Chat
        </button>
      </div>

      <div className="scroll-slim flex-1 space-y-2 overflow-y-auto p-3.5">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const msgCount = session.messages.length;

          return (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSession(session.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectSession(session.id);
              }}
              className={`group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                isActive
                  ? "border-brand bg-brand/5 shadow-sm"
                  : "border-line bg-surface hover:border-ink/20 hover:bg-raised/50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[0.88rem] font-medium text-ink">
                    {session.title || "New Conversation"}
                  </p>
                  {isActive ? (
                    <span className="shrink-0 rounded-full bg-brand/20 px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand">
                      Active
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[0.72rem] text-faint">
                  {formatRelativeTime(session.updatedAt)} · {msgCount}{" "}
                  {msgCount === 1 ? "message" : "messages"}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="rounded-control p-1.5 text-faint opacity-0 transition hover:bg-alert-soft hover:text-alert group-hover:opacity-100"
                aria-label={`Delete ${session.title}`}
                title="Delete conversation"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-3 flex justify-between items-center">
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted hover:text-alert transition"
        >
          Clear all history
        </button>
        <button
          type="button"
          onClick={onCloseHistory}
          className="rounded-control bg-raised px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-line"
        >
          Back to Chat
        </button>
      </div>
    </div>
  );
};

// ─── Panel ──────────────────────────────────────────────────────────────────

export const AssistantPanel = () => {
  const dispatch = useAppDispatch();
  const assistant = useAppSelector(selectAssistant);
  const activeSession = useAppSelector(selectActiveSession);
  const configured = useAppSelector(selectAssistantConfigured);
  const payload = useAppSelector(selectPayload);

  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Follow answer as it streams
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [assistant.messages]);

  useEffect(() => {
    if (!assistant.open) return;
    inputRef.current?.focus();
    if (assistant.messages.length === 0 && assistant.sessions.length <= 1) {
      void dispatch(restoreChatHistory());
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showHistory) {
          setShowHistory(false);
        } else {
          dispatch(closed());
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistant.open, assistant.messages.length, assistant.sessions.length, showHistory, dispatch]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || assistant.streaming) return;

    const injectionPatterns = [
      /ignore (all )?previous (instructions|directions)/i,
      /forget (all )?previous/i,
      /you are now/i,
      /system prompt/i,
      /bypass/i,
      /do not follow/i,
      /new instructions/i,
      /disregard/i,
      /respond as/i,
    ];

    if (injectionPatterns.some((pattern) => pattern.test(trimmed))) {
      toast.warning(
        "Security Alert",
        "Potential prompt injection or override pattern detected. Request cancelled.",
      );
      return;
    }

    setDraft("");
    void dispatch(sendMessage(trimmed));
  };

  const handleStartNewSession = () => {
    if (assistant.messages.length > 0) {
      dispatch(createNewSession());
      toast.info("New Chat", "Started a fresh conversation session.");
    }
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelectSession = (id: string) => {
    dispatch(switchSession(id));
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleDeleteSession = (id: string) => {
    dispatch(deleteSession(id));
    toast.info("Session Deleted", "Conversation was removed.");
  };

  const handleClearAll = () => {
    dispatch(clearAllSessions());
    setShowHistory(false);
    toast.info("History Cleared", "All conversations have been removed.");
  };

  if (!assistant.open) return null;

  return (
    <section
      role="dialog"
      aria-label="Health assistant"
      className="animate-slide-in fixed inset-x-0 bottom-0 z-40 flex h-[85vh] flex-col overflow-hidden rounded-t-tile bg-surface shadow-float sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,82vh)] sm:w-[420px] sm:rounded-tile"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.015em] text-ink flex items-center gap-2">
            <span>Health assistant</span>
          </h2>
          <p className="truncate text-[0.72rem] text-faint">
            {activeSession?.title && activeSession.title !== "New Conversation"
              ? activeSession.title
              : payload
                ? `Reading your ${payload.config.datasetDays} days of data`
                : "Waiting for your dashboard"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* New Chat quick button */}
          <button
            type="button"
            onClick={handleStartNewSession}
            title="Start new conversation"
            className="flex items-center gap-1 rounded-control bg-raised px-2.5 py-1 text-[0.78rem] font-medium text-ink transition hover:bg-line"
          >
            <Plus className="size-3.5 text-muted" />
            <span>New</span>
          </button>

          {/* History drawer toggle */}
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            aria-label={showHistory ? "Back to chat" : "View chat history"}
            title="Chat history & sessions"
            className={`relative rounded-control p-1.5 transition ${
              showHistory
                ? "bg-brand text-brand-ink"
                : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <History className="size-4" />
            {assistant.sessions.length > 1 && !showHistory ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-brand-ink">
                {assistant.sessions.length}
              </span>
            ) : null}
          </button>

          {/* Clear current conversation messages */}
          {!showHistory && assistant.messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                dispatch(resetConversation());
                toast.info("Chat Cleared", "Current conversation messages have been reset.");
              }}
              title="Clear current messages"
              className="rounded-control px-2 py-1 text-[0.78rem] text-muted transition hover:bg-raised hover:text-ink"
            >
              Clear
            </button>
          ) : null}

          {/* Close panel */}
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

      {/* When viewing History Drawer */}
      {showHistory ? (
        <SessionsList
          sessions={assistant.sessions}
          activeSessionId={assistant.activeSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleStartNewSession}
          onClearAll={handleClearAll}
          onCloseHistory={() => setShowHistory(false)}
        />
      ) : (
        /* Regular Conversation View */
        <>
          {assistant.streaming ? (
            <div className="relative h-0.5 w-full overflow-hidden bg-brand-soft" aria-hidden>
              <span className="animate-sweep absolute inset-y-0 w-1/3 rounded-full bg-brand" />
            </div>
          ) : null}

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
              assistant.messages.map((message) => (
                <Bubble key={message.id} message={message} onOptionClick={submit} />
              ))
            )}
          </div>

          {assistant.messages.length === 0 ? <SuggestedChips onPick={submit} /> : null}

          <footer className="border-t border-line bg-surface p-4">
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
                  className="relative flex items-end gap-2 rounded-2xl bg-surface border border-line p-1 shadow-sm focus-within:ring-2 focus-within:ring-brand/40 focus-within:border-transparent transition-all"
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
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit(draft);
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="How am I progressing?"
                    className="scroll-slim max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-[0.95rem] text-ink placeholder:text-muted focus:outline-none"
                  />

                  {assistant.streaming ? (
                    <button
                      type="button"
                      onClick={() => void dispatch(stopStreaming())}
                      className="mb-1 mr-1 grid size-9 shrink-0 place-items-center rounded-xl bg-raised text-muted transition hover:text-ink"
                      aria-label="Stop generating"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={draft.trim().length === 0}
                      className="mb-1 mr-1 grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink transition hover:opacity-90 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </form>

                <p className="mt-3 text-center text-[0.72rem] leading-relaxed text-faint">
                  Not medical advice. This assistant summarises your own recordings.
                </p>
              </>
            )}
          </footer>
        </>
      )}
    </section>
  );
};
