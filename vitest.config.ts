import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    browser: {
      provider: "playwright",
      instances: [{ browser: "chromium" }],
      // headless: true,
    },
    coverage: {
      include: ["**/src/**"],
    },
  },
});
