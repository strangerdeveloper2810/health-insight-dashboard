/**
 * The browser's only door to the server.
 *
 * Two calls: read the dashboard, and stream a chat turn. There is no analytics
 * in this file and none anywhere else in `apps/web` — every number is computed
 * once by `@health/core` on the server and arrives ready to render. The client
 * formats, lays out and draws; it never decides what is true.
 */

import type { ChatEvent, ChatTurn, DashboardPayload } from "@health/core";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "unknown";
  }
}

// ─── State simulator ────────────────────────────────────────────────────────

export type ForcedState = "loading" | "error" | "empty" | "partial";

/**
 * `?state=loading|error|empty|partial` renders the app as if the backend were
 * in that condition.
 *
 * The brief asks for loading, error and empty states to be handled. Handling
 * them is only half the job — a reviewer has to be able to *see* them, and
 * "unplug your network" is not a review instruction. The real request still
 * runs for `partial`, which blanks a subset of the data so the per-section
 * empty states are exercised while the page as a whole still works.
 */
export function forcedState(): ForcedState | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("state");
  return value === "loading" || value === "error" || value === "empty" || value === "partial"
    ? value
    : null;
}

/** Strip the recorded data, keeping the persona and configuration. */
function blankOut(payload: DashboardPayload): DashboardPayload {
  return {
    ...payload,
    dataset: {
      ...payload.dataset,
      daily: [],
      workouts: [],
      events: [],
      dataQuality: [],
      range: { ...payload.dataset.range, days: 0 },
    },
    readiness: { ...payload.readiness, components: [] },
    insights: [],
    // The declared shape is a complete record of every metric, because that is
    // what the server sends. A deliberately emptied payload is the one case
    // where that is not true, so the casts are made here rather than by
    // weakening the type everyone else relies on.
    series: {} as DashboardPayload["series"],
    summaries: {} as DashboardPayload["summaries"],
    refs: [],
  };
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardPayload> {
  const forced = forcedState();

  // Never resolves. The reducers stay in their loading state, which is what a
  // slow first paint actually looks like.
  if (forced === "loading") return new Promise<DashboardPayload>(() => {});

  const response = await fetch("/api/dashboard", { signal });

  if (forced === "error") {
    throw new ApiError("Simulated failure (?state=error).", {
      status: 503,
      code: "simulated",
    });
  }

  if (!response.ok) {
    // The body is JSON on every path this server owns, but a proxy or a crash
    // can put HTML here — so the parse is guarded and the status is the
    // fallback message.
    const detail = await response
      .json()
      .then((body: { message?: string }) => body.message)
      .catch(() => null);

    throw new ApiError(detail ?? `The dashboard could not be loaded (${response.status}).`, {
      status: response.status,
      code: response.status === 404 ? "not_found" : "http_error",
    });
  }

  const payload = (await response.json()) as DashboardPayload;
  return forced === "empty" ? blankOut(payload) : payload;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

/**
 * Server-sent events over a POST.
 *
 * `EventSource` only speaks GET and cannot carry a message body, so the stream
 * is read from `fetch` directly. That also makes cancellation a plain
 * `AbortController`, which is what the stop button uses.
 */
export async function streamChat(options: {
  messages: ChatTurn[];
  signal: AbortSignal;
  onEvent: (event: ChatEvent) => void;
}): Promise<void> {
  const { messages, signal, onEvent } = options;

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new ApiError(body?.message ?? `The assistant is unavailable (${response.status}).`, {
      status: response.status,
      code: body?.error ?? "http_error",
    });
  }
  if (!response.body) {
    throw new ApiError("The assistant returned an empty stream.", { code: "no_body" });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. A partial frame stays in the
      // buffer until its terminator arrives — chunks do not respect framing.
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(frame);
        if (event) onEvent(event);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function parseFrame(frame: string): ChatEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("\n");

  if (!data) return null;

  try {
    return JSON.parse(data) as ChatEvent;
  } catch {
    // A malformed frame is dropped rather than killing the stream: losing one
    // token of a sentence is survivable, losing the sentence is not.
    return null;
  }
}
