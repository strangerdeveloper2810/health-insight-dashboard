/**
 * The assistant turn: prompt assembly, streaming, and the grounding check.
 *
 * The order of operations is the point of the BFF existing: the prompt is built
 * from computed data rather than the client's copy of it (a tampered client can
 * change what is displayed, not what the model is told or which references
 * exist), the history is validated and capped, the answer streams through the
 * tool runner, and the finished text has every citation checked against the
 * reference index — which is what makes the anti-hallucination claim testable.
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  buildDataSnapshot,
  buildSystemPrompt,
  validateCitations,
} from "@health/core";
import type { ChatEvent, ChatTurn, DashboardModel } from "@health/core";

import type { Config } from "./config";
import { createTools } from "./tools";

// The wire protocol lives in `@health/core` so the browser and this server
// cannot disagree about it. Re-exported here because this is where a reader
// looking for "what does the chat endpoint send" will look first.
export type { ChatEvent, ChatTurn };

// ─── History handling ───────────────────────────────────────────────────────

/**
 * Long conversations cost more and drift; the snapshot is resent in full every
 * time, so the model never loses the data it needs when early turns are dropped.
 */
const MAX_HISTORY_TURNS = 16;
const MAX_TURN_CHARS = 4000;

export const sanitiseHistory = (turns: ChatTurn[]): Anthropic.MessageParam[] => {
  return turns
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_TURN_CHARS),
    }));
};

/**
 * Mark the end of the previous turn as a cache breakpoint, so each new turn
 * re-reads the conversation instead of re-processing it. On a short
 * conversation there is nothing to cache yet, and marking it would write a
 * cache entry nobody reads.
 */
export const withHistoryBreakpoint = (
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] => {
  if (messages.length < 6) return messages;

  const target = messages[messages.length - 2];
  if (!target || typeof target.content !== "string") return messages;

  return [
    ...messages.slice(0, -2),
    {
      role: target.role,
      content: [
        {
          type: "text",
          text: target.content,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    messages[messages.length - 1]!,
  ];
};

// ─── Error mapping ──────────────────────────────────────────────────────────

/**
 * Turn an SDK error into something worth showing a user: "529 overloaded" is a
 * stack trace with a nicer font, so each branch says what happened and what the
 * person can do about it.
 */
export const describeError = (
  error: unknown,
): { code: string; message: string; status: number } => {
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      code: "bad_api_key",
      message:
        "The assistant is not connected — the API key was rejected. Check ANTHROPIC_API_KEY in the server environment.",
      status: 502,
    };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return {
      code: "no_access",
      message: "This API key does not have access to the configured model.",
      status: 502,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      code: "rate_limited",
      message: "The assistant is rate limited right now. Try again in a few seconds.",
      status: 429,
    };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return {
      code: "unreachable",
      message: "Could not reach the model provider. Check the server's network connection.",
      status: 504,
    };
  }
  if (error instanceof Anthropic.APIError) {
    // The browser gets a status and nothing else, because a raw upstream body
    // is not something to hand a user. That leaves the status alone as the only
    // clue on the server side, and "400" names no field — so the upstream
    // reason is logged here instead of being discarded.
    console.error(`[chat] upstream ${error.status ?? "?"}: ${error.message}`);
    return {
      code: `api_${error.status ?? "error"}`,
      message: `The model provider returned an error (${error.status ?? "unknown"}). The dashboard itself is unaffected.`,
      status: 502,
    };
  }
  return {
    code: "unknown",
    message: "Something went wrong generating that answer. Your data was not affected.",
    status: 500,
  };
};

// ─── The turn ───────────────────────────────────────────────────────────────

export interface StreamChatOptions {
  config: Config;
  model: DashboardModel;
  client: Anthropic;
  history: ChatTurn[];
  signal: AbortSignal;
  emit: (event: ChatEvent) => void;
}

export const streamChat = async (options: StreamChatOptions): Promise<void> => {
  const { config, model, client, history, signal, emit } = options;

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: buildSystemPrompt(model.bundle.dataset.persona) },
    {
      type: "text",
      text: buildDataSnapshot({
        bundle: model.bundle,
        readiness: model.readiness,
        insights: model.insights,
        index: model.index,
      }),
      // One breakpoint covers the tool definitions and both system blocks —
      // the entire expensive prefix, and byte-identical on every request.
      cache_control: { type: "ephemeral" },
    },
  ];

  const tools = createTools(model.bundle);
  let fullText = "";

  try {
    const runner = client.beta.messages.toolRunner(
      {
        model: config.model,
        max_tokens: config.maxTokens,
        system,
        messages: withHistoryBreakpoint(sanitiseHistory(history)),
        tools: [...tools],
        thinking: { type: "adaptive" },
        output_config: { effort: config.effort },
        // A health question that trips a safety classifier should still get an
        // answer rather than an empty bubble — the API re-runs it on a
        // substitute model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        stream: true,
      },
      // `signal` is a request option, not a body field. Passing it is the whole
      // point of having one: without it, closing the tab leaves the model
      // generating tokens nobody will ever read.
      { signal },
    );

    for await (const stream of runner) {
      for await (const event of stream) {
        if (event.type !== "content_block_start" && event.type !== "content_block_delta") {
          continue;
        }

        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          emit({ type: "tool", name: event.content_block.name, status: "running" });
          continue;
        }

        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          emit({ type: "delta", text: event.delta.text });
        }
      }
    }

    const final = await runner.done();
    const report = validateCitations(fullText, model.index);

    emit({
      type: "done",
      grounding: {
        grounded: report.grounded,
        cited: report.cited,
        unknown: report.unknown,
      },
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      },
      stopReason: final.stop_reason,
    });
  } catch (error) {
    if (signal.aborted) return;
    const described = describeError(error);
    emit({ type: "error", code: described.code, message: described.message });
  }
};
