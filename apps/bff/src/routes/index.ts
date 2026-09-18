import type { FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { Config } from "../config";
import { streamChat } from "../services/chat";
import type { ChatEvent, ChatTurn } from "../services/chat";
import type { DashboardModel } from "@health/core";

// ─── Request validation ─────────────────────────────────────────────────────

const isSafePrompt = (text: string) => {
  const injectionPatterns = [
    /ignore (all )?previous (instructions|directions)/i,
    /forget (all )?previous/i,
    /you are now/i,
    /system prompt/i,
    /bypass/i,
    /do not follow/i,
    /new instructions/i,
    /disregard/i,
    /respond as/i
  ];
  return !injectionPatterns.some(pattern => pattern.test(text));
};

const ChatMessage = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z
      .string()
      .trim()
      .min(1)
      .max(1000, { message: "Message cannot exceed 1000 characters." })
      .refine(isSafePrompt, { message: "Message rejected: potential prompt injection detected." }),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(20000),
  }),
]);

const ChatRequest = z.object({
  messages: z.array(ChatMessage).min(1).max(40),
});

const createClient = (config: Config): Anthropic | null => {
  if (!config.apiKey) return null;
  return new Anthropic({ apiKey: config.apiKey });
};

export interface RouteOptions {
  config: Config;
  model: DashboardModel;
  payload: any;
  client?: Anthropic;
}

export const registerRoutes = ({ config, model, payload, client: testClient }: RouteOptions): FastifyPluginAsync => async (app) => {
  app.get("/api/health", async () => ({
    ok: true,
    assistantConfigured: config.apiKey !== null,
    model: config.model,
    effort: config.effort,
    refs: payload.refs.length,
    insights: payload.insights.length,
  }));

  app.get("/api/dashboard", async (request, reply) => {
    reply.header("cache-control", "private, max-age=300");
    request.log.info(
      {
        seed: config.datasetSeed,
        days: config.datasetDays,
        seriesCount: Object.keys(payload.series).length,
        insightsCount: payload.insights.length,
      },
      "[DASHBOARD] Serving computed dashboard payload",
    );
    return payload;
  });

  app.post("/api/chat", async (request, reply) => {
    const parsed = ChatRequest.safeParse(request.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || "Expected { messages: [{ role, content }] }.";
      request.log.warn(
        {
          error: "invalid_request",
          validationError: errorMessage,
          bodySnippet: JSON.stringify(request.body).slice(0, 200),
        },
        "[CHAT] Request validation failed",
      );
      return reply.status(400).send({
        error: "invalid_request",
        message: errorMessage,
      });
    }

    const client = testClient ?? createClient(config);
    if (!client) {
      request.log.warn("[CHAT] Assistant rejected - ANTHROPIC_API_KEY is not configured");
      return reply.status(503).send({
        error: "assistant_not_configured",
        message:
          "The assistant is not configured on this server. Set ANTHROPIC_API_KEY and restart. The dashboard works without it.",
      });
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    const emit = (event: ChatEvent) => {
      if (raw.writableEnded) return;
      raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const controller = new AbortController();
    raw.on("close", () => controller.abort());

    const history = parsed.data.messages as ChatTurn[];
    const lastUserMessage = history.filter((m) => m.role === "user").pop();
    const startTime = Date.now();

    request.log.info(
      {
        turns: history.length,
        promptPreview: lastUserMessage ? lastUserMessage.content.slice(0, 80) : "",
        model: config.model,
        effort: config.effort,
      },
      `[CHAT] Starting generation for: "${lastUserMessage?.content.slice(0, 60)}..."`,
    );

    try {
      await streamChat({
        config,
        model,
        client,
        history,
        signal: controller.signal,
        emit,
      });
    } finally {
      if (!raw.writableEnded) raw.end();
      const elapsed = Date.now() - startTime;
      request.log.info(
        {
          durationMs: elapsed,
          aborted: controller.signal.aborted,
        },
        `[CHAT] Stream closed in ${elapsed}ms (aborted: ${controller.signal.aborted})`,
      );
    }

    return reply;
  });
};
