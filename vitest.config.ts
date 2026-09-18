import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@health/core": path.resolve(import.meta.dirname, "packages/core/src/index.ts"),
      "@": path.resolve(import.meta.dirname, "apps/web/src"),
    },
  },
  test: {
    // `packages/core` holds pure analytics/grounding logic.
    // `apps/bff` is tested through Fastify with injected LLM client.
    // `apps/web` tests features like assistant multi-session state management.
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/bff/src/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
    environment: "node",
  },
});

