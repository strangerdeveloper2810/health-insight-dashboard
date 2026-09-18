import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";

let app: FastifyInstance | null = null;

export async function getFastifyServerlessApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildServer();
    await app.ready();
  }
  return app;
}

export default async function serverlessHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const fastify = await getFastifyServerlessApp();

  // If Vercel or proxy forwards a path without /api prefix, fix it so Fastify routes match
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/?")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  // If rewritten to /api/index, check x-matched-path
  const matchedPath = req.headers["x-matched-path"];
  if (typeof matchedPath === "string" && matchedPath.startsWith("/api/")) {
    req.url = matchedPath;
  }

  fastify.server.emit("request", req, res);
}
