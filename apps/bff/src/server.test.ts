/**
 * BFF tests.
 *
 * Nothing here touches the network. The Anthropic client is injected through
 * `buildServer({ client })`, and the fake below replays a scripted stream — so
 * these tests exercise the real orchestration (prompt assembly, SSE framing,
 * citation validation, history capping) rather than a mock of it.
 *
 * The grounding tests are the ones worth reading. They assert the property the
 * whole design rests on: a number the model invents cannot reach the user
 * looking like a fact.
 */

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { buildServer } from "./server";
import { describeError, sanitiseHistory, withHistoryBreakpoint } from "./chat";
import type { ChatEvent, ChatTurn } from "./chat";
import { loadConfig } from "./config";
import type { Config } from "./config";

// ─── Fixtures ───────────────────────────────────────────────────────────────

/**
 * One config for the whole file. The dashboard is memoised per seed and days,
 * so varying it here would only rebuild the same person repeatedly.
 */
const CONFIG: Config = {
  ...loadConfig(),
  apiKey: "sk-ant-test-key-that-must-never-be-echoed",
  datasetSeed: 20260918,
  datasetDays: 90,
};

type StreamEvent = Record<string, unknown>;

/** A streamed assistant text block, as the SDK's stream events would deliver it. */
function textEvents(text: string): StreamEvent[] {
  return [
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
  ];
}

/** A tool call appearing mid-stream — the runner would execute it after this turn. */
function toolEvents(name: string): StreamEvent[] {
  return [
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "toolu_test", name, input: {} },
    },
    { type: "content_block_stop", index: 0 },
  ];
}

function finalMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 6000, output_tokens: 120, cache_read_input_tokens: 5900 },
    ...overrides,
  };
}

interface FakeOptions {
  iterations: StreamEvent[][];
  final?: Record<string, unknown>;
  /** Capture the params the runner was called with, for prompt assertions. */
  onCall?: (params: Record<string, unknown>) => void;
}

function fakeClient(options: FakeOptions): Anthropic {
  return {
    beta: {
      messages: {
        toolRunner: (params: Record<string, unknown>) => {
          options.onCall?.(params);
          return {
            async *[Symbol.asyncIterator]() {
              for (const events of options.iterations) {
                yield (async function* () {
                  for (const event of events) yield event;
                })();
              }
            },
            done: async () => finalMessage(options.final),
          };
        },
      },
    },
  } as unknown as Anthropic;
}

/**
 * Parse an SSE body into `{ event, data }` pairs, typed as the union the
 * server actually emits — so the tests below assert the wire contract rather
 * than whatever shape happens to be in the JSON.
 */
function parseSse(body: string): { event: string; data: ChatEvent }[] {
  return body
    .split("\n\n")
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "";
      const raw = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "{}";
      return { event, data: JSON.parse(raw) as ChatEvent };
    });
}

type DoneEvent = Extract<ChatEvent, { type: "done" }>;

/** The completion event, narrowed. Throws rather than returning undefined so a
 *  missing event fails the test at the point of the mistake. */
function doneOf(body: string): DoneEvent {
  const last = parseSse(body).at(-1);
  if (last?.data.type !== "done") {
    throw new Error(`expected a done event, got: ${last?.event ?? "nothing"}`);
  }
  return last.data;
}

async function chat(
  config: Config,
  messages: ChatTurn[],
  client?: Anthropic,
): Promise<{ status: number; body: string }> {
  const app = await buildServer({ config, client });
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/api/chat",
    payload: { messages },
  });
  const body = response.body;
  await app.close();
  return { status: response.statusCode, body };
}

// ─── Request validation and configuration ───────────────────────────────────

describe("POST /api/chat — guards", () => {
  it("rejects a body that is not a message list", async () => {
    const app = await buildServer({ config: CONFIG });
    await app.ready();

    for (const payload of [{}, { messages: [] }, { messages: [{ role: "system", content: "hi" }] }]) {
      const response = await app.inject({ method: "POST", url: "/api/chat", payload });
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
    }

    await app.close();
  });

  it("reports itself unconfigured rather than failing when there is no API key", async () => {
    const { status, body } = await chat({ ...CONFIG, apiKey: null }, [
      { role: "user", content: "How am I doing?" },
    ]);

    expect(status).toBe(503);
    expect(JSON.parse(body).error).toBe("assistant_not_configured");
  });
});

describe("GET /api/health", () => {
  it("never echoes key material", async () => {
    const app = await buildServer({ config: CONFIG });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/health" });
    await app.close();

    const body = response.body;
    // The endpoint is unauthenticated, so this is the assertion that matters:
    // presence is reported, the value, its prefix and its length are not.
    expect(body).not.toContain("sk-ant-test-key");
    expect(body).not.toContain("apiKey");
    expect(response.json()).toMatchObject({ ok: true, assistantConfigured: true });
  });
});

// ─── Streaming ──────────────────────────────────────────────────────────────

describe("POST /api/chat — streaming", () => {
  it("streams deltas, then a grounded completion", async () => {
    const { status, body } = await chat(
      CONFIG,
      [{ role: "user", content: "How is my resting heart rate?" }],
      fakeClient({
        iterations: [textEvents("Your resting heart rate is {{restingHeartRate.avg7d}} bpm.")],
      }),
    );

    expect(status).toBe(200);
    const events = parseSse(body);
    expect(events.map((e) => e.event)).toEqual(["delta", "done"]);

    const done = doneOf(body);
    expect(done.grounding).toMatchObject({ grounded: true, unknown: [] });
    expect(done.grounding.cited).toEqual(["restingHeartRate.avg7d"]);
    expect(done.usage).toEqual({
      inputTokens: 6000,
      outputTokens: 120,
      cacheReadTokens: 5900,
    });
  });

  it("flags a citation that does not resolve", async () => {
    const { body } = await chat(
      CONFIG,
      [{ role: "user", content: "Summarise my health." }],
      fakeClient({
        iterations: [
          textEvents("Your VO2 max is {{vo2max.avg7d}} and readiness is {{readiness.score}}."),
        ],
      }),
    );

    const done = doneOf(body);
    // `vo2max` is not a metric this app tracks. The reply is still delivered —
    // the user sees it — but it is marked as not fully grounded rather than
    // passing silently as fact.
    expect(done.grounding).toMatchObject({ grounded: false, unknown: ["vo2max.avg7d"] });
    expect(done.grounding.cited).toContain("readiness.score");
  });

  it("reports a tool call before the text it produced", async () => {
    const { body } = await chat(
      CONFIG,
      [{ role: "user", content: "How has my sleep changed night to night?" }],
      fakeClient({
        iterations: [
          toolEvents("get_sleep_breakdown"),
          textEvents("Bedtime varies by {{derived.bedtimeStdDevMin}}."),
        ],
      }),
    );

    const events = parseSse(body);
    expect(events.map((e) => e.event)).toEqual(["tool", "delta", "done"]);
    expect(events[0]!.data).toMatchObject({ name: "get_sleep_breakdown", status: "running" });
  });

  it("accumulates text across every iteration of the tool loop", async () => {
    const { body } = await chat(
      CONFIG,
      [{ role: "user", content: "Compare my steps this week to last." }],
      fakeClient({
        iterations: [
          toolEvents("compare_periods"),
          textEvents("Steps are averaging {{steps.avg7d}}"),
          textEvents(", which is {{steps.change7d}}% versus the week before."),
        ],
      }),
    );

    // Validation runs over the whole reply, not just the final iteration — a
    // citation emitted before the last tool call still has to resolve.
    const done = doneOf(body);
    expect(done.grounding.grounded).toBe(true);
    expect(done.grounding.cited).toEqual(["steps.avg7d", "steps.change7d"]);
  });

  it("sends the prompt the assistant is supposed to be answering from", async () => {
    let captured: Record<string, unknown> | null = null;
    await chat(
      CONFIG,
      [{ role: "user", content: "What should I focus on?" }],
      fakeClient({ iterations: [textEvents("Sleep.")], onCall: (p) => (captured = p) }),
    );

    const params = captured!;
    expect(params.model).toBe(CONFIG.model);

    // Two system blocks: the standing instructions, then the live data. Only
    // the second is huge, and both are byte-identical between requests — which
    // is what makes the cache breakpoint on the last one worth having.
    const system = params.system as { text: string; cache_control?: unknown }[];
    expect(system).toHaveLength(2);
    expect(system[0]!.cache_control).toBeUndefined();
    expect(system[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(system[1]!.text).toContain("readiness.score");

    // Four read-only tools. They cannot mutate and cannot reach the network.
    expect((params.tools as unknown[]).length).toBe(4);
  });

  it("maps an SDK error to something a person can act on", async () => {
    const app = await buildServer({
      config: CONFIG,
      client: {
        beta: {
          messages: {
            toolRunner: () => {
              throw new Anthropic.RateLimitError(
                429,
                { error: { message: "slow down" } },
                "slow down",
                new Headers(),
              );
            },
          },
        },
      } as unknown as Anthropic,
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { messages: [{ role: "user", content: "hi" }] },
    });
    await app.close();

    const events = parseSse(response.body);
    expect(events.at(-1)!.event).toBe("error");
    expect(events.at(-1)!.data).toMatchObject({ code: "rate_limited" });
    // The stream still opened with 200 — the failure is an event, not a status,
    // because the headers were already sent by the time the model was called.
    expect(response.statusCode).toBe(200);
  });
});

// ─── History handling ───────────────────────────────────────────────────────

describe("sanitiseHistory", () => {
  it("drops blank turns and keeps the most recent ones", () => {
    const turns: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i}`,
    }));

    const result = sanitiseHistory([{ role: "user", content: "   " }, ...turns]);
    expect(result).toHaveLength(16);
    expect(result.at(-1)!.content).toBe("turn 19");
  });

  it("truncates an oversized turn instead of rejecting the request", () => {
    const result = sanitiseHistory([{ role: "user", content: "x".repeat(9000) }]);
    expect(result[0]!.content).toHaveLength(4000);
  });

  it("keeps the roles alternating and in order", () => {
    const result = sanitiseHistory([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ]);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});

describe("withHistoryBreakpoint", () => {
  const turns = (n: number): ChatTurn[] =>
    Array.from({ length: n }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i}`,
    }));

  it("marks nothing on a short conversation", () => {
    // A breakpoint here would write a cache entry that is never read back,
    // which costs more than it saves.
    const messages = sanitiseHistory(turns(4));
    expect(withHistoryBreakpoint(messages)).toEqual(messages);
  });

  it("marks the second-to-last turn once there is history worth caching", () => {
    const messages = sanitiseHistory(turns(8));
    const result = withHistoryBreakpoint(messages);

    expect(result).toHaveLength(8);
    expect(result.at(-1)).toEqual(messages.at(-1));

    const marked = result.at(-2)!.content as { cache_control?: unknown }[];
    expect(marked[0]!.cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("describeError", () => {
  it("names the cause and the remedy for each SDK error class", () => {
    const headers = new Headers();
    const error = { error: { message: "x" } };

    const cases: [unknown, string][] = [
      [new Anthropic.AuthenticationError(401, error, "x", headers), "bad_api_key"],
      [new Anthropic.PermissionDeniedError(403, error, "x", headers), "no_access"],
      [new Anthropic.RateLimitError(429, error, "x", headers), "rate_limited"],
      [new Anthropic.APIConnectionError({ message: "x" }), "unreachable"],
      [new Anthropic.InternalServerError(500, error, "x", headers), "api_500"],
      [new Error("something else"), "unknown"],
    ];

    for (const [thrown, code] of cases) {
      const described = describeError(thrown);
      expect(described.code, String(thrown)).toBe(code);
      // Every message is a sentence for a person, not a status code with a
      // nicer font.
      expect(described.message.length).toBeGreaterThan(20);
      expect(described.message).not.toMatch(/\bundefined\b|\bnull\b/);
    }
  });
});
