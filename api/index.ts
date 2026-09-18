import type { IncomingMessage, ServerResponse } from "node:http";
import serverlessHandler from "./serverless.bundle.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return serverlessHandler(req, res);
}
