/**
 * The assistant's slice.
 *
 * A turn is a user message, then an assistant message that starts empty with
 * `status: "streaming"` and fills in as deltas arrive. The placeholder exists
 * from the first moment so the panel has something to render a caret and a
 * tool indicator inside.
 *
 * The `grounding` field is not decoration. It is the server's verdict on
 * whether every number in the answer resolved against the reference index, and
 * the UI shows it.
 */

import { createAsyncThunk, createSlice, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ChatTurn } from "@health/core";

import { ApiError, streamChat } from "@/api/client";
import type { RootState } from "@/app/store";

export interface Grounding {
  grounded: boolean;
  cited: string[];
  unknown: string[];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Assistant messages only. */
  status?: "streaming" | "complete" | "error";
  grounding?: Grounding;
  /** Tool names the model called while producing this answer. */
  tools?: string[];
  error?: { code: string; message: string };
  usage?: Usage;
}

export interface AssistantState {
  open: boolean;
  messages: AssistantMessage[];
  streaming: boolean;
  /** Set when the last turn ended with citations that did not resolve. */
  ungroundedTurns: number;
}

const initialState: AssistantState = {
  open: false,
  messages: [],
  streaming: false,
  ungroundedTurns: 0,
};

// ─── Streaming ──────────────────────────────────────────────────────────────

/**
 * The in-flight request, held outside the store.
 *
 * An `AbortController` is not serialisable, and putting it in state would mean
 * turning off the serialisability check for the whole slice to accommodate one
 * field. It is only ever read by the stop button, so a module variable is the
 * right size of solution.
 */
let inFlight: AbortController | null = null;

export const sendMessage = createAsyncThunk<void, string, { state: RootState }>(
  "assistant/send",
  async (text, { dispatch, getState }) => {
    const trimmed = text.trim();
    if (!trimmed || inFlight) return;

    dispatch(
      userMessageAdded({ id: nanoid(), role: "user", content: trimmed }),
    );

    // Built after the user's turn is in state and before the placeholder, so
    // the history sent to the server ends with the question being asked.
    const history: ChatTurn[] = getState()
      .assistant.messages.filter((message) => message.content.trim().length > 0)
      .map((message) => ({ role: message.role, content: message.content }));

    const replyId = nanoid();
    dispatch(replyStarted(replyId));

    const controller = new AbortController();
    inFlight = controller;
    dispatch(streamingChanged(true));

    try {
      await streamChat({
        messages: history,
        signal: controller.signal,
        onEvent: (event) => {
          switch (event.type) {
            case "delta":
              dispatch(deltaReceived({ id: replyId, text: event.text }));
              break;
            case "tool":
              dispatch(toolCalled({ id: replyId, name: event.name }));
              break;
            case "done":
              dispatch(
                replyFinished({
                  id: replyId,
                  grounding: event.grounding,
                  usage: event.usage,
                }),
              );
              break;
            case "error":
              dispatch(
                replyFailed({ id: replyId, code: event.code, message: event.message }),
              );
              break;
          }
        },
      });
    } catch (error) {
      // An abort is the user's own doing — the text already streamed stays,
      // marked as stopped rather than as a failure.
      if (controller.signal.aborted) {
        dispatch(replyFinished({ id: replyId, stopped: true }));
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : "The assistant could not be reached. The dashboard is unaffected.";
        dispatch(
          replyFailed({
            id: replyId,
            code: error instanceof ApiError ? error.code : "network",
            message,
          }),
        );
      }
    } finally {
      inFlight = null;
      dispatch(streamingChanged(false));
    }
  },
);

export const stopStreaming = createAsyncThunk<void, void>("assistant/stop", async () => {
  inFlight?.abort();
  inFlight = null;
});

// ─── Slice ──────────────────────────────────────────────────────────────────

type ReplyPatch = Partial<AssistantMessage> & { id: string };

const patchReply = (state: AssistantState, patch: ReplyPatch): AssistantMessage | undefined => {
  const target = state.messages.find((message) => message.id === patch.id);
  if (target) Object.assign(target, patch);
  return target;
};

const assistantSlice = createSlice({
  name: "assistant",
  initialState,
  reducers: {
    opened: (state) => {
      state.open = true;
    },
    closed: (state) => {
      state.open = false;
    },
    toggled: (state) => {
      state.open = !state.open;
    },
    userMessageAdded: (state, action: PayloadAction<AssistantMessage>) => {
      state.messages.push(action.payload);
    },
    replyStarted: (state, action: PayloadAction<string>) => {
      state.messages.push({
        id: action.payload,
        role: "assistant",
        content: "",
        status: "streaming",
        tools: [],
      });
    },
    deltaReceived: (state, action: PayloadAction<{ id: string; text: string }>) => {
      const target = state.messages.find((message) => message.id === action.payload.id);
      if (target) target.content += action.payload.text;
    },
    toolCalled: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const target = state.messages.find((message) => message.id === action.payload.id);
      if (!target) return;
      target.tools ??= [];
      if (!target.tools.includes(action.payload.name)) target.tools.push(action.payload.name);
    },
    replyFinished: (
      state,
      action: PayloadAction<{
        id: string;
        grounding?: Grounding;
        usage?: Usage;
        stopped?: boolean;
      }>,
    ) => {
      const { id, grounding, usage, stopped } = action.payload;
      patchReply(state, { id, status: "complete", grounding, usage });
      if (grounding && !grounding.grounded) state.ungroundedTurns += 1;
      // A stopped reply with nothing in it would render as an empty bubble.
      if (stopped) {
        const target = state.messages.find((message) => message.id === id);
        if (target && target.content.trim() === "") {
          target.content = "_Stopped before any answer arrived._";
        }
      }
    },
    replyFailed: (
      state,
      action: PayloadAction<{ id: string; code: string; message: string }>,
    ) => {
      patchReply(state, {
        id: action.payload.id,
        status: "error",
        error: { code: action.payload.code, message: action.payload.message },
      });
    },
    /**
     * Whether a turn is in flight.
     *
     * Kept as its own action rather than derived from `messages.some(m =>
     * m.status === "streaming")` because the two disagree in the window that
     * matters: a `done` event marks the message complete before the stream
     * itself has closed, and the composer must not re-enable in between.
     */
    streamingChanged: (state, action: PayloadAction<boolean>) => {
      state.streaming = action.payload;
    },
    reset: (state) => {
      state.messages = [];
      state.ungroundedTurns = 0;
      state.streaming = false;
    },
  },
});

export const {
  opened,
  closed,
  toggled,
  userMessageAdded,
  replyStarted,
  deltaReceived,
  toolCalled,
  replyFinished,
  replyFailed,
  streamingChanged,
  reset: resetConversation,
} = assistantSlice.actions;

export default assistantSlice.reducer;
