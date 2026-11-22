// Browser tests run in Playwright; server-side workers must use the same
// runtime as the process that launched Vitest.
if (typeof document === "undefined") {
  const runtime = "Bun" in globalThis ? "bun" : "Deno" in globalThis ? "deno" : "node";
  if (runtime !== process.env.BLOSSOM_TEST_RUNTIME) {
    throw new Error(`Expected ${process.env.BLOSSOM_TEST_RUNTIME} test worker, got ${runtime}`);
  }
}
