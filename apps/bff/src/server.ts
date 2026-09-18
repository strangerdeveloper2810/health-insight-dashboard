/**
 * The BFF: `GET /api/health`, `GET /api/dashboard`, and `POST /api/chat`
 * (server-sent events).
 *
 * The chat route is why this server exists rather than calling the model from
 * the browser — the API key never leaves this process, the prompt is assembled
 * from data the client cannot touch, and the citation check runs where the
 * reference index lives.
 */

import Anthropic from "@anthropic-ai/sdk";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { loadConfig } from "./config";
import type { Config } from "./config";
import { streamChat } from "./chat";
import type { ChatEvent, ChatTurn } from "./chat";
import { getDashboard } from "./dashboard";

// ─── Request validation ─────────────────────────────────────────────────────

const ChatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

// ─── Server ─────────────────────────────────────────────────────────────────

export interface BuildServerOptions {
  config?: Config;
  /** Injected in tests so the suite never reaches the network. */
  client?: Anthropic;
}

export const buildServer = async (options: BuildServerOptions = {}): Promise<FastifyInstance> => {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    // Silent under test: the request log is useful in a terminal and noise in
    // an assertion failure.
    logger: {
      level:
        process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
    },
  });

  await app.register(cors, {
    origin: config.webOrigin,
    methods: ["GET", "POST"],
  });

  const { model, payload } = getDashboard(config);

  app.get("/api/health", async () => ({
    ok: true,
    // Presence, never the value: this endpoint is unauthenticated, so no key
    // material, no prefix, no length.
    assistantConfigured: config.apiKey !== null,
    model: config.model,
    effort: config.effort,
    refs: payload.refs.length,
    insights: payload.insights.length,
  }));

  app.get("/api/dashboard", async (_request, reply) => {
    // The payload is identical for every caller and changes only on restart.
    reply.header("cache-control", "private, max-age=300");
    return payload;
  });

  app.post("/api/chat", async (request, reply) => {
    const parsed = ChatRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        message: "Expected { messages: [{ role, content }] }.",
      });
    }

    const client = options.client ?? createClient(config);
    if (!client) {
      return reply.status(503).send({
        error: "assistant_not_configured",
        message:
          "The assistant is not configured on this server. Set ANTHROPIC_API_KEY and restart. The dashboard works without it.",
      });
    }

    // Take over the response: from here Fastify must not touch it.
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Stops proxies from buffering the stream into one late lump.
      "x-accel-buffering": "no",
    });

    const emit = (event: ChatEvent) => {
      if (raw.writableEnded) return;
      raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    // If the user closes the tab mid-answer, stop generating.
    //
    // Listen on the *response*, not `request.raw`: that also emits 'close', but
    // the moment the request body has been read — before the model is called.
    // Aborting there kills every turn before its first token, and since
    // `streamChat` stays quiet once aborted, the caller gets a 200 and an empty
    // stream rather than an error.
    const controller = new AbortController();
    raw.on("close", () => controller.abort());

    const history = parsed.data.messages as ChatTurn[];
    request.log.info({ turns: history.length }, "chat request");

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
    }

    return reply;
  });

  return app;
};

const createClient = (config: Config): Anthropic | null => {
  if (!config.apiKey) return null;
  return new Anthropic({ apiKey: config.apiKey });
};

// ─── Entry point ────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");

if (isMain) {
  const config = loadConfig();
  const app = await buildServer({ config });

  try {
    await app.listen({ port: config.port, host: "127.0.0.1" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  if (!config.apiKey) {
    app.log.warn(
      "ANTHROPIC_API_KEY is not set — the dashboard will work and the assistant will report itself as unconfigured.",
    );
  }
}
