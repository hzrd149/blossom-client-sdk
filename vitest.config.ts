import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    browser: {
      name: "chromium",
      provider: "playwright",
      providerOptions: {},
    },
    coverage: {
      include: ["**/src/**"],
    },
  },
});
