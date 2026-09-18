import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `packages/core` holds the logic that matters most — insight rules,
    // readiness score, citation validation — as pure TypeScript with no DOM
    // and no network. `apps/bff` is tested through the same runner: its
    // Anthropic client is injected, so the suite never makes a real request.
    include: ["packages/*/src/**/*.test.ts", "apps/bff/src/**/*.test.ts"],
    environment: "node",
  },
});
