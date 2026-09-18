import type { IncomingMessage, ServerResponse } from "node:http";
import serverlessHandler from "../apps/bff/src/serverless";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return serverlessHandler(req, res);
}
