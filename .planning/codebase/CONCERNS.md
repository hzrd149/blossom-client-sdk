# Codebase Concerns

**Analysis Date:** 2026-07-25

## Tech Debt

**Duplicated challenge/retry flow across action modules:**
- Issue: Auth and Cashu payment challenge handling is repeated in `uploadBlob`, `uploadMedia`, `mirrorBlob`, `downloadBlob`, `listBlobs`, and `deleteBlob` instead of sharing a single request/challenge helper.
- Files: `src/actions/upload.ts`, `src/actions/media.ts`, `src/actions/mirror.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/delete.ts`
- Impact: Behavior drifts between endpoints. `src/actions/media.ts` already differs by using raw `fetch` while the other modules use `fetchWithTimeout`, and upload fallback handling differs between `/upload` and `/media`.
- Fix approach: Extract a shared internal helper for `401` auth, `402` Cashu payment, timeout propagation, and `HTTPError.handleErrorResponse`; have each action supply endpoint-specific request construction only.

**Committed build output can drift from source:**
- Issue: Generated files in `lib/` are committed alongside `src/`, but tests import from `src/` and do not verify packaged `exports` against `lib/`.
- Files: `lib/index.js`, `lib/actions/index.js`, `package.json`, `tests/actions/index.test.ts`, `tests/index.test.ts`
- Impact: Published package behavior can diverge from tested source behavior, especially when `package.json` export paths point at build artifacts that tests never load.
- Fix approach: Add a package-smoke test that runs after `pnpm build` and imports each `package.json` export from `lib/`; keep generated `lib/` synchronized in release verification.

**Loose `any` in multi-server defaults and callbacks:**
- Issue: Default options and internal payment handlers use `any` despite strict TypeScript settings.
- Files: `src/actions/multi-server.ts`
- Impact: Type regressions in the highest-complexity orchestration path can compile without catching callback shape mistakes.
- Fix approach: Replace `MultiServerUploadOptions<any, any>` and `_blob: any` with `unknown` or concrete generic helper types; keep callback signatures tied to `S` and `B`.

## Known Bugs

**`./actions` package export points to a missing file:**
- Symptoms: Consumers importing `blossom-client-sdk/actions` resolve to `./lib/actions.js`, but the build emits `lib/actions/index.js`; the directory listing contains `lib/actions/` and no `lib/actions.js`.
- Files: `package.json`, `src/actions/index.ts`, `lib/actions/index.js`
- Trigger: Install/build the package and run `import * as Actions from "blossom-client-sdk/actions"` using Node ESM package exports.
- Workaround: Use the root namespace export via `import { Actions } from "blossom-client-sdk"` or import a concrete subpath such as `blossom-client-sdk/actions/upload`.

**`uploadMedia` ignores the timeout option:**
- Symptoms: `timeout` is accepted in `UploadMediaOptions`, but `uploadMedia` calls raw `fetch` for `HEAD /media` and `PUT /media`, so `opts.timeout` is never applied.
- Files: `src/actions/media.ts`, `src/helpers/fetch.ts`, `tests/actions/media.test.ts`
- Trigger: Call `uploadMedia(server, blob, { timeout: 50 })` against a slow `/media` endpoint.
- Workaround: Pass an external `AbortSignal` in `opts.signal`; do not rely on the `timeout` option for media uploads until `fetchWithTimeout` is used.

**`uploadBlob` drops upload headers when `HEAD /upload` returns 404:**
- Symptoms: The fallback direct `PUT /upload` performed after a `404` HEAD response sends `body`, `method`, `signal`, and `timeout`, but not the prepared `X-SHA-256`, `X-Content-Length`, or `X-Content-Type` headers.
- Files: `src/actions/upload.ts`, `tests/actions/upload.test.ts`
- Trigger: Use a Blossom server that does not implement `HEAD /upload` and expects upload metadata headers on the direct `PUT /upload` request.
- Workaround: Prefer servers with `HEAD /upload` support; update fallback PUT construction to include the same upload headers used by normal PUT requests.

**Preflight mirror failure can be silently skipped for servers that already have a blob:**
- Symptoms: In `multiServerUpload`, if preflight says a server has the blob and the `/mirror` registration fails, the code continues without calling `onError` and without a result for that server.
- Files: `src/actions/multi-server.ts`, `tests/actions/multi-server.test.ts`
- Trigger: A server returns success for `HEAD /<sha256>` but rejects or fails `PUT /mirror`.
- Workaround: Inspect the returned `Map` for missing servers; do not rely only on `onError` for per-server accounting.

## Security Considerations

**Authorization server matching ignores scheme and port:**
- Risk: Reusable auth events are matched by lowercase hostname only. An auth scoped for `https://example.com` can match `http://example.com`, `https://example.com:8443`, or another service on the same host.
- Files: `src/helpers/url.ts`, `src/auth.ts`, `tests/auth.test.ts`
- Current mitigation: Auth events can include `server` tags and expiration tags; expired auth events are pruned in `getReusableAuthEvent`.
- Recommendations: Match auth server tags by normalized origin when protocol and port are meaningful for the Blossom auth model, or document hostname-only reuse as an intentional security boundary.

**Untrusted Blossom URI server hints become fetch/browser targets:**
- Risk: `xs` hints and fallback server lists are converted into HTTP(S) URLs and used by `resolveBlob`, `getBlobUrls`, and DOM media fallback helpers. In browser contexts this can trigger requests to arbitrary origins supplied by content.
- Files: `src/actions/resolve.ts`, `src/media.ts`, `src/helpers/blossom-uri.ts`
- Current mitigation: Resolution only fetches blob paths derived from the URI hash and extension; consumers control whether `fallbackServers` and `getServers` are supplied.
- Recommendations: Document that applications should vet or constrain untrusted server hints when request destinations matter; consider an allowlist/filter callback before generated URLs are fetched or assigned to DOM media elements.

**Cashu payment token handling is caller-provided and unvalidated after challenge parsing:**
- Risk: Payment callbacks receive a parsed payment request and the returned token is encoded directly into `X-Cashu` for retry; the SDK does not validate mint policy, amount ceilings, or token provenance.
- Files: `src/actions/upload.ts`, `src/actions/media.ts`, `src/actions/mirror.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/delete.ts`, `src/helpers/cashu.ts`
- Current mitigation: Payment is opt-in through `onPayment`; missing payment handlers throw instead of auto-paying.
- Recommendations: Keep policy enforcement in application `onPayment` callbacks; add examples that validate amount, unit, mint, and request ID before returning a token.

## Performance Bottlenecks

**Blob hashing loads whole blobs into memory:**
- Problem: `computeBlobSha256` calls `blob.arrayBuffer()` for `Blob` and `File` inputs, then hashes the full buffer.
- Files: `src/helpers/blob.ts`, `src/actions/upload.ts`, `src/actions/media.ts`, `src/actions/multi-server.ts`
- Cause: The hashing helper is buffer-based rather than stream-based.
- Improvement path: Add streaming SHA-256 for platforms that expose `Blob.stream()` or Node streams; preserve `BlobHashSymbol` caching to avoid repeat hashing.

**Parallel preflight has no concurrency limit:**
- Problem: `multiServerUpload` and `multiServerMediaUpload` start `HEAD /<sha256>` checks against every target server at once.
- Files: `src/actions/multi-server.ts`
- Cause: Preflight uses `Promise.allSettled(uploadServers.map(...))` and `Promise.allSettled(remainingServers.map(...))` without a pool size.
- Improvement path: Add an optional `preflightConcurrency` setting with a conservative default for large server lists.

**Resolver tries candidate URLs sequentially:**
- Problem: `resolveBlob` tries xs hints, author servers, and fallback servers one URL at a time; slow or timing-out servers delay later healthy servers.
- Files: `src/actions/resolve.ts`
- Cause: `tryUrls` awaits each fetch before trying the next URL.
- Improvement path: Add a bounded parallel or hedged request mode while keeping deterministic priority for the first successful response.

## Fragile Areas

**Multi-server upload orchestration:**
- Files: `src/actions/multi-server.ts`, `tests/actions/multi-server.test.ts`
- Why fragile: The module combines preflight checks, upload fallback, mirror fallback, auth reuse, Cashu payment handling, media optimization, rejection policy, and callback reporting in one 364-line file.
- Safe modification: Add targeted tests in `tests/actions/multi-server.test.ts` for every callback and status-code branch before changing control flow; verify returned `Map` contents and callback calls together.
- Test coverage: High for common paths, but missing explicit coverage for silent preflight mirror failures and package-level export behavior.

**DOM media fallback timing:**
- Files: `src/media.ts`, `tests/media.test.ts`, `vitest.config.ts`
- Why fragile: Browser media elements emit real asynchronous `error` events that race with test-dispatched events; tests install a capture-phase blocker to avoid flaky behavior.
- Safe modification: Run `pnpm vitest run --browser --browser.headless` for changes to `src/media.ts`; keep cleanup paths deterministic and avoid assuming exactly one error event per failed URL.
- Test coverage: Browser tests cover fallback cycling, mutation observer attach/detach, blossom URI handling, and cleanup, but the race workaround means real browser event ordering remains sensitive.

**HLS loader wrapper lifecycle:**
- Files: `src/hls.ts`, `tests/hls.test.ts`
- Why fragile: The wrapper dynamically instantiates hls.js loaders, mutates context URLs between origins, tracks penalties in a closure-scoped map, and forwards callback state manually.
- Safe modification: Preserve context fields when replacing origins; test abort, destroy, timeout, and custom retry-status interactions whenever loader callbacks change.
- Test coverage: Covers playlist/fragment fallback, sticky failover, query/header/range preservation, and non-retryable statuses; abort/destroy lifecycle paths have no direct tests.

## Scaling Limits

**Large uploads:**
- Current capacity: Limited by available memory for `Blob.arrayBuffer()` plus the original blob contents.
- Limit: Very large browser `Blob` or `File` uploads can allocate a full extra `ArrayBuffer` during SHA-256 computation before upload starts.
- Scaling path: Implement streaming hash computation in `src/helpers/blob.ts` and keep hash caching to prevent repeat full reads in `src/actions/multi-server.ts`.

**Large server lists:**
- Current capacity: No explicit server count limit.
- Limit: Preflight creates one promise and fetch per server at once; resolver fallback can spend `timeout * serverCount` wall-clock time in sequential mode.
- Scaling path: Add configurable concurrency for preflight in `src/actions/multi-server.ts` and optional hedged/parallel resolution in `src/actions/resolve.ts`.

## Dependencies at Risk

**Optional peer dependencies loaded at runtime:**
- Risk: `@cashu/cashu-ts` and `hls.js` are optional peers. Payment paths dynamically import Cashu helpers, and HLS types/classes assume consumers install compatible `hls.js`.
- Impact: Consumers that use payment or HLS APIs without installing matching peers get runtime module-resolution failures rather than compile-time package dependency guarantees.
- Migration plan: Keep dynamic imports for optional weight, but document peer installation per feature and add package-smoke tests for missing-peer error messages.

**No lint tool beyond TypeScript and Prettier:**
- Risk: The project has strict TypeScript and formatting, but no lint rules for import hygiene, promise misuse, complexity, or package export validation.
- Impact: Issues like duplicated challenge code, raw `fetch` in timeout-aware modules, and export-map drift are not caught automatically.
- Migration plan: Add focused checks first: package export smoke tests, `tsc --noEmit`/`pnpm build` in CI, and optionally ESLint rules only where they catch current risks.

## Missing Critical Features

**Packaged export verification:**
- Problem: Tests verify source exports from `src/actions/index.ts` but not the published `package.json` `exports` map.
- Blocks: Reliable release of `./actions` and future subpath entrypoints.

**Timeout consistency for every network action:**
- Problem: `timeout` is exposed through shared upload options, but not every action consistently uses `fetchWithTimeout`.
- Blocks: Consumers cannot rely on a uniform cancellation contract across `uploadBlob`, `uploadMedia`, `mirrorBlob`, `downloadBlob`, `listBlobs`, and `deleteBlob`.

## Test Coverage Gaps

**Package export map:**
- What's not tested: Importing built package entrypoints through `package.json` exports, especially `./actions`.
- Files: `package.json`, `lib/actions/index.js`, `tests/actions/index.test.ts`
- Risk: Broken published entrypoints pass the source test suite.
- Priority: High

**Timeout behavior in media uploads:**
- What's not tested: A timeout assertion that proves `fetchWithTimeout` is used by `uploadMedia` for both `HEAD /media` and retry `PUT /media` requests.
- Files: `src/actions/media.ts`, `tests/actions/media.test.ts`
- Risk: Slow media endpoints hang until external fetch/browser timeout despite the SDK option.
- Priority: High

**Fallback direct upload headers:**
- What's not tested: Header presence on `PUT /upload` after `HEAD /upload` returns `404`.
- Files: `src/actions/upload.ts`, `tests/actions/upload.test.ts`
- Risk: Servers without HEAD support can reject uploads because required metadata headers are absent.
- Priority: Medium

**HLS abort/destroy forwarding:**
- What's not tested: Aborting or destroying a `BlossomHlsLoader` while an attempt is active, including whether callbacks stop and the active base loader is cleaned up.
- Files: `src/hls.ts`, `tests/hls.test.ts`
- Risk: Playback integrations can leak loaders or receive callbacks after teardown.
- Priority: Medium

---

*Concerns audit: 2026-07-25*
