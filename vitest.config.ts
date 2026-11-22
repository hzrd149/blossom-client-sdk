import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/runtime-check.ts"],
    env: {
      // Pass the launcher's runtime into workers so a fallback to Node cannot
      // silently turn a Bun/Deno run into another Node run.
      BLOSSOM_TEST_RUNTIME: process.versions.bun ? "bun" : process.versions.deno ? "deno" : "node",
    },
    browser: {
      provider: "playwright",
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
    coverage: {
      include: ["**/src/**"],
    },
  },
});
