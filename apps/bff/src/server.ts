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

import { loadConfig } from "./config";
import type { Config } from "./config";
import { getDashboard } from "./services/dashboard";
import { registerRoutes } from "./routes";
import { generateRequestId, getLoggerConfig, registerLoggingHooks } from "./utils/logger";

// ─── Server ─────────────────────────────────────────────────────────────────

export interface BuildServerOptions {
  config?: Config;
  /** Injected in tests so the suite never reaches the network. */
  client?: Anthropic;
}

export const buildServer = async (options: BuildServerOptions = {}): Promise<FastifyInstance> => {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    genReqId: generateRequestId,
    logger: getLoggerConfig(),
  });

  registerLoggingHooks(app);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or serverless same-origin rewrites)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (
        origin === config.webOrigin ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        process.env.NODE_ENV === "production" ||
        process.env.VERCEL
      ) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  });

  const { model, payload } = getDashboard(config);

  await app.register(registerRoutes({ config, model, payload, client: options.client }));

  return app;
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
