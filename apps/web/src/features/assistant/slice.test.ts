import { describe, expect, it } from "vitest";
import assistantReducer, {
  createNewSession,
  deleteSession,
  resetConversation,
  switchSession,
  userMessageAdded,
} from "./slice";

describe("Assistant Slice - Multi-Session State Management", () => {
  it("initializes with one default session", () => {
    const state = assistantReducer(undefined, { type: "@@INIT" });
    expect(state.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe(state.sessions[0].id);
    expect(state.sessions[0].title).toBe("New Conversation");
    expect(state.messages).toEqual([]);
  });

  it("adds user message to current session and auto-generates title", () => {
    let state = assistantReducer(undefined, { type: "@@INIT" });
    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-1",
        role: "user",
        content: "What is my average resting heart rate?",
      }),
    );

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe("What is my average resting heart rate?");
    
    // Check that active session is updated with the message and title
    const active = state.sessions.find((s) => s.id === state.activeSessionId);
    expect(active?.messages).toHaveLength(1);
    expect(active?.title).toBe("What is my average resting heart rate?");
  });

  it("creates a new session without losing previous session", () => {
    let state = assistantReducer(undefined, { type: "@@INIT" });
    const firstSessionId = state.activeSessionId;

    // First session has a message
    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-1",
        role: "user",
        content: "Session 1 Question",
      }),
    );

    // User creates new session
    state = assistantReducer(state, createNewSession());

    expect(state.sessions).toHaveLength(2);
    expect(state.activeSessionId).not.toBe(firstSessionId);
    expect(state.messages).toHaveLength(0); // Fresh conversation

    // Verify first session is still intact
    const firstSession = state.sessions.find((s) => s.id === firstSessionId);
    expect(firstSession).toBeDefined();
    expect(firstSession?.messages).toHaveLength(1);
    expect(firstSession?.title).toBe("Session 1 Question");
  });

  it("switches back and forth between sessions smoothly", () => {
    let state = assistantReducer(undefined, { type: "@@INIT" });
    const session1Id = state.activeSessionId;

    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-1",
        role: "user",
        content: "Question in Session 1",
      }),
    );

    state = assistantReducer(state, createNewSession());
    const session2Id = state.activeSessionId;

    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-2",
        role: "user",
        content: "Question in Session 2",
      }),
    );

    expect(state.messages[0].content).toBe("Question in Session 2");

    // Switch back to Session 1
    state = assistantReducer(state, switchSession(session1Id));
    expect(state.activeSessionId).toBe(session1Id);
    expect(state.messages[0].content).toBe("Question in Session 1");

    // Switch to Session 2
    state = assistantReducer(state, switchSession(session2Id));
    expect(state.activeSessionId).toBe(session2Id);
    expect(state.messages[0].content).toBe("Question in Session 2");
  });

  it("deletes a session and switches to remaining session", () => {
    let state = assistantReducer(undefined, { type: "@@INIT" });
    const session1Id = state.activeSessionId;

    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-1",
        role: "user",
        content: "Session 1 Question",
      }),
    );

    state = assistantReducer(state, createNewSession());
    const session2Id = state.activeSessionId;

    expect(state.sessions).toHaveLength(2);

    // Delete Session 2 while it is active
    state = assistantReducer(state, deleteSession(session2Id));

    expect(state.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe(session1Id);
    expect(state.messages[0].content).toBe("Session 1 Question");
  });

  it("resetConversation only clears the active session", () => {
    let state = assistantReducer(undefined, { type: "@@INIT" });
    const session1Id = state.activeSessionId;

    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-1",
        role: "user",
        content: "Keep this session",
      }),
    );

    state = assistantReducer(state, createNewSession());
    state = assistantReducer(
      state,
      userMessageAdded({
        id: "msg-2",
        role: "user",
        content: "Clear this session",
      }),
    );

    // Reset active session
    state = assistantReducer(state, resetConversation());
    expect(state.messages).toHaveLength(0);

    // Switch to first session, it should still have its message
    state = assistantReducer(state, switchSession(session1Id));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe("Keep this session");
  });
});
