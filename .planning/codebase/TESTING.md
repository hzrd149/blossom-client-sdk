# Testing Patterns

**Analysis Date:** 2026-07-25

## Test Framework

**Runner:**
- Vitest `^3.1.3` from `package.json`.
- Config: `vitest.config.ts` sets the default environment to `node`, configures browser tests with Playwright Chromium, and includes `**/src/**` in coverage.

**Assertion Library:**
- Vitest `expect` with standard matchers, async `.resolves`/`.rejects`, inline snapshots, and asymmetric matchers such as `expect.objectContaining` and `expect.arrayContaining`.

**Run Commands:**
```bash
pnpm test                                  # Run all node tests with vitest run
pnpm vitest run tests/auth.test.ts         # Run one test file
pnpm vitest run --browser --browser.headless # Run browser suite for DOM/media helpers
pnpm coverage                              # Run coverage using @vitest/coverage-v8
```

## Test File Organization

**Location:**
- Tests live in the top-level `tests/` directory, not co-located with `src/`.
- Action tests mirror `src/actions/` under `tests/actions/`, e.g. `src/actions/upload.ts` ↔ `tests/actions/upload.test.ts`.
- Helper tests mirror `src/helpers/` under `tests/helpers/`, e.g. `src/helpers/blossom-uri.ts` ↔ `tests/helpers/blossom-uri.test.ts`.
- Shared test utilities live in `tests/fetch.ts` and `tests/mock-servers.ts`.

**Naming:**
- Use `*.test.ts` for test files: `tests/auth.test.ts`, `tests/media.test.ts`, `tests/actions/multi-server.test.ts`.
- Name top-level suites after the function or module under test: `describe("uploadBlob", ...)` in `tests/actions/upload.test.ts`, `describe("parseBlossomURI", ...)` in `tests/helpers/blossom-uri.test.ts`.

**Structure:**
```
tests/
├── *.test.ts                 # Core module tests for src/*.ts
├── actions/*.test.ts         # Tests for src/actions/*.ts
├── helpers/*.test.ts         # Tests for src/helpers/*.ts
├── fetch.ts                  # Global fetch mock setup
└── mock-servers.ts           # Reusable mock Blossom server classes
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, vi } from "vitest";
import { uploadBlob } from "../../src/actions/upload.js";
import fetchMock from "../fetch.js";

describe("uploadBlob", async () => {
  const mockServer = "https://example.com";
  const mockBlob = new Blob(["test content"], { type: "text/plain" });

  describe("with HEAD /upload support", () => {
    it("should check if upload is allowed with HEAD request first", async () => {
      fetchMock.mockResponses(["", { status: 200 }], [JSON.stringify(mockResponse), { status: 200 }]);

      await uploadBlob(mockServer, mockBlob);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.requests()[0].method).toBe("HEAD");
    });
  });
});
```

**Patterns:**
- Group behavior by protocol branch or feature area, e.g. `with HEAD /upload support`, `without HEAD /upload support`, `Authorization`, and `Payment` in `tests/actions/upload.test.ts` and `tests/actions/multi-server.test.ts`.
- Use `async` tests and await all SDK calls; many source APIs hash blobs, sign Nostr events, or make mocked fetch calls.
- Build reusable constants at suite scope when async setup is needed, e.g. `mockSha256` and `mockAuth` in `tests/actions/upload.test.ts`.
- Assert HTTP requests by inspecting `fetchMock.requests()` or `MockServer.endpoints`, as in `tests/actions/upload.test.ts` and `tests/actions/multi-server.test.ts`.
- Use `it.each` for scenario matrices with equivalent expectations, as in broken-server fallback cases in `tests/actions/multi-server.test.ts`.

## Mocking

**Framework:** Vitest mocks plus `vitest-fetch-mock`

**Patterns:**
```typescript
// tests/fetch.ts
const fetchMock = createFetchMock(vi);
fetchMock.enableMocks();
beforeEach(() => {
  fetchMock.resetMocks();
});

// tests/actions/multi-server.test.ts
beforeEach(() => {
  fetchMock.mockResponse((req) => {
    for (const server of mockServers) {
      if (req.url.startsWith(server.url)) return server.handleRequest(req);
    }
  });
});
```

**What to Mock:**
- Mock global `fetch` for all HTTP-facing action tests using `tests/fetch.ts`.
- Use `fetchMock.mockResponses()` for linear request/response flows, as in `tests/actions/upload.test.ts`.
- Use `MockServer` subclasses from `tests/mock-servers.ts` for multi-server orchestration, authorization challenges, payment challenges, server errors, missing media endpoints, and known BUD rejections.
- Use `vi.fn().mockResolvedValue(...)` for callbacks like `onAuth`, `onPayment`, and `getServers`, as in `tests/actions/upload.test.ts` and `tests/media.test.ts`.

**What NOT to Mock:**
- Do not mock hashing/signing helpers when testing auth and upload behavior; tests use real `getBlobSha256()` in `tests/auth.test.ts` and real `nostr-tools` `finalizeEvent()` in `tests/actions/upload.test.ts`.
- Do not mock DOM primitives in media tests; run them in the Vitest browser environment and gate with `describe.runIf(typeof document !== "undefined")` in `tests/media.test.ts`.
- Do not mock public helper functions when their behavior is the unit under test, e.g. `parseBlossomURI()` in `tests/helpers/blossom-uri.test.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
// tests/mock-servers.ts
export const uploadBlob = new Blob(["test content"], { type: "text/plain" });
export const uploadHash = await getBlobSha256(uploadBlob);

export class MockServerRequireAuth extends MockServer {
  constructor(url: string) {
    super(url);
    this.upload.mockImplementation((req) => {
      if (!req.headers.has("Authorization")) return { status: 401 };
      return { status: 200, body: JSON.stringify(createMockResponse(this.url)) };
    });
  }
}
```

**Location:**
- Use `tests/mock-servers.ts` for reusable Blossom server fixtures and failure-mode classes.
- Use suite-local fixtures for simple module tests, such as `HASH` and `PUBKEY` in `tests/helpers/blossom-uri.test.ts` and `tests/media.test.ts`.
- Use real generated Nostr keys at module scope when signing auth events: `generateSecretKey()` and `finalizeEvent()` in `tests/auth.test.ts` and `tests/actions/multi-server.test.ts`.

## Coverage

**Requirements:** None enforced beyond including `**/src/**` in `vitest.config.ts`; no coverage threshold is configured.

**View Coverage:**
```bash
pnpm coverage
```

## Test Types

**Unit Tests:**
- Pure helper and protocol unit tests live in `tests/helpers/*.test.ts`, `tests/auth.test.ts`, `tests/nostr.test.ts`, and `tests/error.test.ts`.
- Assert parsed objects, thrown error messages, tag contents, event kinds, and utility return values directly.

**Integration Tests:**
- HTTP/action integration tests live in `tests/actions/*.test.ts` and exercise action functions through mocked fetch responses or mock server classes.
- Multi-server tests in `tests/actions/multi-server.test.ts` verify request ordering, fallback behavior, auth reuse, payment handling, rejection callbacks, and media upload mirroring.

**E2E Tests:**
- No external end-to-end service tests are detected.
- Browser integration tests for DOM-facing media helpers live in `tests/media.test.ts` and run with Vitest Browser + Playwright Chromium.

## Common Patterns

**Async Testing:**
```typescript
it("should retry with auth when receiving 401 status on HEAD", async () => {
  fetchMock.mockResponses(["", { status: 401 }], [JSON.stringify(mockResponse), { status: 200 }]);

  const onAuth = vi.fn().mockResolvedValue(mockAuth);
  await uploadBlob(mockServer, mockBlob, { onAuth });

  expect(onAuth).toHaveBeenCalledWith(mockServer, mockSha256, "upload", mockBlob);
});
```

**Error Testing:**
```typescript
await expect(uploadBlob(mockServer, mockBlob)).rejects.toThrow("Missing auth handler");
expect(() => parseBlossomURI(`${HASH}.png`)).toThrow("missing blossom: scheme");
await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toBeInstanceOf(HTTPError);
```

**Browser Testing:**
```typescript
describe.runIf(typeof document !== "undefined")("handleMediaFallbacks", () => {
  it("should handle fallbacks for img elements", async () => {
    const image = document.createElement("img");
    image.src = `https://server1.com/${HASH}.jpg`;
    image.dataset.pubkey = "test-pubkey";

    const removeListener = handleMediaFallbacks(image, getServers);
    image.dispatchEvent(new Event("error"));

    await vi.waitFor(() => {
      expect(image.src).toBe(`https://server2.com/${HASH}.jpg`);
    });

    removeListener();
    image.remove();
  });
});
```

---

*Testing analysis: 2026-07-25*
