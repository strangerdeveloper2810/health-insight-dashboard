import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@health/core": path.resolve(here, "../../packages/core/src/index.ts"),
      "@": path.resolve(here, "src"),
    },
  },
  server: {
    port: 4000,
    // The browser only ever talks to the Vite origin. Requests to /api are
    // forwarded to the Fastify BFF, which is the only process holding the key.
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT ?? 8787}`,
        changeOrigin: true,
      },
    },
  },
});
