/**
 * The assistant's slice with multi-session chat history support.
 * Each conversation session has its own timeline, ungrounded count, and title.
 * Storage uses IndexedDB with sessionStorage fallback and zero Immer proxy revoking.
 */

import { createAsyncThunk, createSlice, current, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ChatTurn } from "@health/core";

import { ApiError, streamChat } from "@/shared/api/client";
import type { RootState } from "@/app/store";
import {
  clearAllChatData,
  loadChatData,
  saveChatData,
} from "./storage";
import type { ChatSession, StoredChatData } from "./storage";

export type { ChatSession, StoredChatData };

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
  sessions: ChatSession[];
  activeSessionId: string;
  messages: AssistantMessage[];
  streaming: boolean;
  /** Set when the last turn ended with citations that did not resolve. */
  ungroundedTurns: number;
}

const initialSessionId = nanoid();
const initialSession: ChatSession = {
  id: initialSessionId,
  title: "New Conversation",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
  ungroundedTurns: 0,
};

const initialState: AssistantState = {
  open: false,
  sessions: [initialSession],
  activeSessionId: initialSessionId,
  messages: [],
  streaming: false,
  ungroundedTurns: 0,
};

export const restoreChatHistory = createAsyncThunk<StoredChatData | null>(
  "assistant/restoreHistory",
  async () => {
    return await loadChatData();
  },
);

// ─── Streaming ──────────────────────────────────────────────────────────────

let inFlight: AbortController | null = null;

export const sendMessage = createAsyncThunk<void, string, { state: RootState }>(
  "assistant/send",
  async (text, { dispatch, getState }) => {
    const trimmed = text.trim();
    if (!trimmed || inFlight) return;

    dispatch(
      userMessageAdded({ id: nanoid(), role: "user", content: trimmed }),
    );

    // History sent to the server ends with the question being asked
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

// ─── Helpers ────────────────────────────────────────────────────────────────

type ReplyPatch = Partial<AssistantMessage> & { id: string };

const patchReply = (state: AssistantState, patch: ReplyPatch): AssistantMessage | undefined => {
  const target = state.messages.find((message) => message.id === patch.id);
  if (target) Object.assign(target, patch);
  return target;
};

const syncActiveSession = (state: AssistantState) => {
  const currentSession = state.sessions.find((s) => s.id === state.activeSessionId);
  if (currentSession) {
    currentSession.messages = state.messages;
    currentSession.ungroundedTurns = state.ungroundedTurns;
    currentSession.updatedAt = Date.now();
  }
};

const getSessionsSnapshot = (sessions: ChatSession[]): ChatSession[] => {
  try {
    return current(sessions);
  } catch {
    return sessions;
  }
};

const persistState = (state: AssistantState) => {
  syncActiveSession(state);
  void saveChatData({
    sessions: getSessionsSnapshot(state.sessions),
    activeSessionId: state.activeSessionId,
  });
};

// ─── Slice ──────────────────────────────────────────────────────────────────

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
      const currentSession = state.sessions.find((s) => s.id === state.activeSessionId);
      if (currentSession) {
        if (currentSession.title === "New Conversation" && action.payload.content.trim()) {
          const trimmed = action.payload.content.trim();
          currentSession.title = trimmed.length > 38 ? `${trimmed.slice(0, 38)}…` : trimmed;
        }
      }
      persistState(state);
    },
    replyStarted: (state, action: PayloadAction<string>) => {
      state.messages.push({
        id: action.payload,
        role: "assistant",
        content: "",
        status: "streaming",
        tools: [],
      });
      syncActiveSession(state);
    },
    deltaReceived: (state, action: PayloadAction<{ id: string; text: string }>) => {
      const target = state.messages.find((message) => message.id === action.payload.id);
      if (target) target.content += action.payload.text;
      syncActiveSession(state);
    },
    toolCalled: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const target = state.messages.find((message) => message.id === action.payload.id);
      if (!target) return;
      target.tools ??= [];
      if (!target.tools.includes(action.payload.name)) target.tools.push(action.payload.name);
      syncActiveSession(state);
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
      if (stopped) {
        const target = state.messages.find((message) => message.id === id);
        if (target && target.content.trim() === "") {
          target.content = "_Stopped before any answer arrived._";
        }
      }
      persistState(state);
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
      persistState(state);
    },
    streamingChanged: (state, action: PayloadAction<boolean>) => {
      state.streaming = action.payload;
    },

    // ─── Multi-Session Actions ──────────────────────────────────────────────

    createNewSession: (state) => {
      // If current session is already completely empty, reuse it
      if (state.messages.length === 0) return;

      const newId = nanoid();
      const newSession: ChatSession = {
        id: newId,
        title: "New Conversation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        ungroundedTurns: 0,
      };
      state.sessions.unshift(newSession);
      state.activeSessionId = newId;
      state.messages = [];
      state.ungroundedTurns = 0;
      state.streaming = false;
      persistState(state);
    },

    switchSession: (state, action: PayloadAction<string>) => {
      if (state.activeSessionId === action.payload) return;
      const targetSession = state.sessions.find((s) => s.id === action.payload);
      if (!targetSession) return;

      // Sync active before switching
      syncActiveSession(state);

      state.activeSessionId = targetSession.id;
      state.messages = targetSession.messages;
      state.ungroundedTurns = targetSession.ungroundedTurns;
      state.streaming = false;
      persistState(state);
    },

    deleteSession: (state, action: PayloadAction<string>) => {
      const targetId = action.payload;
      const index = state.sessions.findIndex((s) => s.id === targetId);
      if (index !== -1) {
        state.sessions.splice(index, 1);
      }

      // If active session was deleted, switch to another or initialize empty
      if (state.activeSessionId === targetId) {
        if (state.sessions.length > 0) {
          const nextSession = state.sessions[0];
          state.activeSessionId = nextSession.id;
          state.messages = nextSession.messages;
          state.ungroundedTurns = nextSession.ungroundedTurns;
        } else {
          const freshId = nanoid();
          const freshSession: ChatSession = {
            id: freshId,
            title: "New Conversation",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            ungroundedTurns: 0,
          };
          state.sessions = [freshSession];
          state.activeSessionId = freshId;
          state.messages = [];
          state.ungroundedTurns = 0;
        }
      }
      state.streaming = false;
      persistState(state);
    },

    renameSession: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const target = state.sessions.find((s) => s.id === action.payload.id);
      if (target && action.payload.title.trim()) {
        target.title = action.payload.title.trim();
        target.updatedAt = Date.now();
        persistState(state);
      }
    },

    reset: (state) => {
      // Clears current session messages
      state.messages = [];
      state.ungroundedTurns = 0;
      state.streaming = false;
      const currentSession = state.sessions.find((s) => s.id === state.activeSessionId);
      if (currentSession) {
        currentSession.messages = [];
        currentSession.ungroundedTurns = 0;
        currentSession.title = "New Conversation";
        currentSession.updatedAt = Date.now();
      }
      persistState(state);
    },

    clearAllSessions: (state) => {
      const freshId = nanoid();
      const freshSession: ChatSession = {
        id: freshId,
        title: "New Conversation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        ungroundedTurns: 0,
      };
      state.sessions = [freshSession];
      state.activeSessionId = freshId;
      state.messages = [];
      state.ungroundedTurns = 0;
      state.streaming = false;
      void clearAllChatData();
    },
  },
  extraReducers: (builder) => {
    builder.addCase(restoreChatHistory.fulfilled, (state, action) => {
      const payload = action.payload;
      if (!payload || !payload.sessions || payload.sessions.length === 0) return;

      // Only restore if user hasn't already begun chatting in this mount
      if (state.messages.length === 0) {
        state.sessions = payload.sessions;
        const active =
          payload.sessions.find((s) => s.id === payload.activeSessionId) ?? payload.sessions[0];
        state.activeSessionId = active.id;
        state.messages = active.messages;
        state.ungroundedTurns = active.ungroundedTurns;
      }
    });
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
  createNewSession,
  switchSession,
  deleteSession,
  renameSession,
  reset: resetConversation,
  clearAllSessions,
} = assistantSlice.actions;

export default assistantSlice.reducer;
