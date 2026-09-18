import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";

export const getLoggerConfig = (): FastifyServerOptions["logger"] => {
  const isTest = process.env.NODE_ENV === "test";
  if (isTest) {
    return {
      level: process.env.LOG_LEVEL ?? "silent",
    };
  }

  return {
    level: process.env.LOG_LEVEL ?? "info",
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          path: req.routeOptions?.url ?? req.url,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
      err(err) {
        return {
          type: err.name,
          message: err.message,
          code: (err as any).code,
          stack: err.stack ?? "",
        };
      },
    },
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "*.apiKey",
      "*.anthropicApiKey",
      "*.password",
      "*.secret",
    ],
  };
};

export const registerLoggingHooks = (app: FastifyInstance): void => {
  // Log every incoming request
  app.addHook("onRequest", async (request) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
      `--> [${request.method}] ${request.url}`,
    );
  });

  // Log every response with execution latency
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(reply.elapsedTime),
      },
      `<-- [${request.method}] ${request.url} ${reply.statusCode} (${Math.round(reply.elapsedTime)}ms)`,
    );
  });

  // Log unhandled errors
  app.addHook("onError", async (request, reply, error) => {
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        error: {
          name: error.name,
          message: error.message,
          code: (error as any).code,
          stack: error.stack,
        },
      },
      `[ERROR] [${request.method}] ${request.url}: ${error.message}`,
    );
  });
};

export const generateRequestId = (req: { headers: Record<string, any> }): string => {
  return (req.headers["x-request-id"] as string) || `req-${randomUUID().slice(0, 8)}`;
};
