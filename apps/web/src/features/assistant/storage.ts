import type { AssistantMessage } from "./slice";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AssistantMessage[];
  ungroundedTurns: number;
}

export interface StoredChatData {
  sessions: ChatSession[];
  activeSessionId: string;
}

const DB_NAME = "HealthAssistantSecureDB";
const STORE_NAME = "chat_history";
const DB_VERSION = 1;
const SESSIONS_KEY = "chat_sessions_v2";
const LEGACY_KEY = "current_session_messages";

// Cleanup legacy localStorage keys if present
if (typeof window !== "undefined" && window.localStorage) {
  try {
    localStorage.removeItem("health_assistant_messages_v1");
  } catch {}
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
};

/**
 * Save all sessions and active session pointer with synchronous snapshotting.
 * Primary store: IndexedDB.
 * Secondary fallback: sessionStorage.
 */
export const saveChatData = async (data: StoredChatData): Promise<void> => {
  if (typeof window === "undefined") return;

  // Immediately serialize synchronously to detach from any Immer proxy / Draft
  let serialized: StoredChatData;
  try {
    serialized = JSON.parse(JSON.stringify(data));
  } catch {
    serialized = {
      sessions: data.sessions.map((s) => ({ ...s, messages: [...s.messages] })),
      activeSessionId: data.activeSessionId,
    };
  }

  // Cap messages per session to 50 latest to preserve storage
  const payload: StoredChatData = {
    activeSessionId: serialized.activeSessionId,
    sessions: serialized.sessions.map((session) => ({
      ...session,
      messages: session.messages.slice(-50),
    })),
  };

  // 1. Try IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(payload, SESSIONS_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("[Storage] IndexedDB write failed, falling back to sessionStorage", err);
  }

  // 2. Fallback in sessionStorage
  try {
    if (window.sessionStorage) {
      sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(payload));
    }
  } catch {}
};

/**
 * Load chat sessions and active session.
 * Supports auto-migration from legacy single-session storage if found.
 */
export const loadChatData = async (): Promise<StoredChatData | null> => {
  if (typeof window === "undefined") return null;

  // Helper to sanitize messages (e.g. streaming -> complete)
  const sanitizeMessages = (msgs: AssistantMessage[]): AssistantMessage[] => {
    return msgs.map((msg) =>
      msg.status === "streaming" ? { ...msg, status: "complete" as const } : msg,
    );
  };

  const sanitizeData = (data: StoredChatData): StoredChatData => {
    return {
      activeSessionId: data.activeSessionId,
      sessions: data.sessions.map((session) => ({
        ...session,
        messages: sanitizeMessages(session.messages),
      })),
    };
  };

  // 1. Try IndexedDB (v2 multi-session)
  try {
    const db = await openDB();
    const result = await new Promise<StoredChatData | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(SESSIONS_KEY);

      request.onsuccess = () => {
        const raw = request.result;
        if (raw && Array.isArray(raw.sessions) && raw.sessions.length > 0) {
          resolve(raw as StoredChatData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });

    if (result) {
      return sanitizeData(result);
    }

    // 1b. Check if legacy single-session data exists in IndexedDB for auto-migration
    const legacyResult = await new Promise<AssistantMessage[] | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(LEGACY_KEY);

      request.onsuccess = () => {
        const raw = request.result;
        if (Array.isArray(raw) && raw.length > 0) {
          resolve(raw);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });

    if (legacyResult && legacyResult.length > 0) {
      const firstUserMsg = legacyResult.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? "…" : ""))
        : "Previous Conversation";
      const legacySession: ChatSession = {
        id: "migrated_session_1",
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: sanitizeMessages(legacyResult),
        ungroundedTurns: legacyResult.filter((m) => m.grounding && !m.grounding.grounded).length,
      };
      const migrated: StoredChatData = {
        sessions: [legacySession],
        activeSessionId: legacySession.id,
      };
      // Persist migrated session
      void saveChatData(migrated);
      return migrated;
    }
  } catch (err) {
    console.warn("[Storage] IndexedDB read failed, checking sessionStorage fallback", err);
  }

  // 2. Try sessionStorage fallback
  try {
    if (window.sessionStorage) {
      const raw = sessionStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          return sanitizeData(parsed);
        }
      }

      // Legacy fallback in sessionStorage
      const legacyRaw = sessionStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const firstUserMsg = parsed.find((m: AssistantMessage) => m.role === "user");
          const title = firstUserMsg
            ? (firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? "…" : ""))
            : "Previous Conversation";
          const migrated: StoredChatData = {
            sessions: [
              {
                id: "migrated_session_1",
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: sanitizeMessages(parsed),
                ungroundedTurns: parsed.filter(
                  (m: AssistantMessage) => m.grounding && !m.grounding.grounded,
                ).length,
              },
            ],
            activeSessionId: "migrated_session_1",
          };
          return migrated;
        }
      }
    }
  } catch {}

  return null;
};

/**
 * Clear all chat history and sessions from all storage mechanisms.
 */
export const clearAllChatData = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    if (window.sessionStorage) {
      sessionStorage.removeItem(SESSIONS_KEY);
      sessionStorage.removeItem(LEGACY_KEY);
    }
  } catch {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(SESSIONS_KEY);
      store.delete(LEGACY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
};
