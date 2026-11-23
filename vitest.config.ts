import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Bun's child-process IPC lacks the channel.unref() used by Vitest's fork watchdog.
    pool: process.versions.bun ? "threads" : "forks",
    setupFiles: ["tests/runtime-check.ts"],
    env: {
      // Pass the launcher's runtime into workers so a fallback to Node cannot
      // silently turn a Bun/Deno run into another Node run.
      BLOSSOM_TEST_RUNTIME: process.versions.bun ? "bun" : process.versions.deno ? "deno" : "node",
    },
    browser: {
      provider: playwright(),
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
    coverage: {
      include: ["**/src/**"],
    },
  },
});
