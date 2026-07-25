<!-- refreshed: 2026-07-25 -->
# Architecture

**Analysis Date:** 2026-07-25

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Public SDK Entry Points                   │
├──────────────────┬──────────────────┬───────────────────────┤
│ Root exports      │ Subpath exports  │ Optional adapters      │
│ `src/index.ts`    │ `src/actions/*`  │ `src/media.ts`,        │
│                  │ `src/helpers/*`  │ `src/hls.ts`           │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                         Behavior Layer                       │
│  Single-server actions: `src/actions/upload.ts`,             │
│  `src/actions/download.ts`, `src/actions/list.ts`,           │
│  `src/actions/delete.ts`, `src/actions/mirror.ts`,           │
│  `src/actions/media.ts`, `src/actions/resolve.ts`            │
│  Multi-server orchestration: `src/actions/multi-server.ts`   │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                         Core Support                         │
│  Auth: `src/auth.ts`  Types: `src/types.ts`                  │
│  Errors: `src/error.ts`  Nostr: `src/nostr.ts`               │
│  Helpers: `src/helpers/*.ts`                                 │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Blossom Servers / Browser APIs              │
│  HTTP endpoints `/upload`, `/media`, `/mirror`, `/<sha256>`, │
│  `/list/<pubkey>`, `/report`; DOM and HLS runtime APIs       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root barrel | Re-export public constants, auth helpers, helper functions, media utilities, Nostr utilities, errors, types, and the `Actions` namespace. | `src/index.ts` |
| Action barrel | Re-export all action modules for `Actions.*` usage and action subpath imports. | `src/actions/index.ts` |
| Auth core | Build Nostr kind `24242` auth events, encode authorization headers, normalize server tags, match reusable auth events, and prune expired events. | `src/auth.ts` |
| Single-server upload | Implement BUD upload flow with `HEAD /upload` preflight, auth retry, Cashu payment retry, and final `PUT /upload`. | `src/actions/upload.ts` |
| Media upload | Implement `/media` optimized upload flow and surface `MediaEndpointMissingError` when the endpoint is absent. | `src/actions/media.ts` |
| Mirror | Register an existing blob on another server via `PUT /mirror` with auth/payment handling. | `src/actions/mirror.ts` |
| Download | Fetch blobs from `/<sha256>` with optional auth/payment retry. | `src/actions/download.ts` |
| List | Fetch paginated `/list/<pubkey>` results and expose an async page iterator. | `src/actions/list.ts` |
| Delete | Delete blobs via `DELETE /<sha256>` with optional auth/payment retry. | `src/actions/delete.ts` |
| Existence check | Check blob presence with `HEAD /<sha256>`. | `src/actions/has.ts` |
| URI resolution | Parse `blossom:` URIs, collect server hints, resolve author servers via callback, and sequentially try download URLs. | `src/actions/resolve.ts` |
| Multi-server orchestration | Coordinate preflight checks, initial upload, mirror fan-out, media optimization, auth-event reuse, rejection handling, and callbacks. | `src/actions/multi-server.ts` |
| Reports | Validate signed NIP-56 blob report events and send them to multiple servers. | `src/actions/report.ts` |
| Blob helpers | Compute/cache SHA-256, detect SHA-256 strings, get size, and get MIME type for `Blob`, `File`, and `Buffer`. | `src/helpers/blob.ts` |
| Fetch helpers | Wrap `fetch` with optional timeout-backed `AbortSignal`. | `src/helpers/fetch.ts`, `src/helpers/signal.ts` |
| Blossom URI helpers | Parse and build `blossom:` URI data structures. | `src/helpers/blossom-uri.ts` |
| URL helpers | Normalize server hostnames and extract SHA-256 hashes from URLs. | `src/helpers/url.ts` |
| Cashu helpers | Lazily decode Cashu payment requests while keeping `@cashu/cashu-ts` optional. | `src/helpers/cashu.ts` |
| Browser media fallback | Attach DOM error handlers and `MutationObserver` fallback resolution for image/video/audio elements. | `src/media.ts` |
| HLS fallback loaders | Build `hls.js` playlist and fragment loader classes with origin failover and optional sticky penalties. | `src/hls.ts` |
| Shared types | Define SDK data contracts, callback signatures, auth event shapes, blob descriptors, and structural Cashu copies. | `src/types.ts` |

## Pattern Overview

**Overall:** Functional TypeScript ESM SDK with layered action functions and callback-injected integrations.

**Key Characteristics:**
- Public API is export-driven: `package.json` `exports` points consumers to built files in `lib/`, while source entrypoints live under `src/index.ts`, `src/actions/index.ts`, and `src/helpers/index.ts`.
- Behavior is organized as standalone async functions rather than classes; add new server operations as `src/actions/<operation>.ts` with an exported options type and function.
- External integration is dependency-injected through callbacks (`onAuth`, `onPayment`, `getServers`, `onError`) and optional peer dependencies loaded with dynamic `import()`.
- Shared mutable state is caller-owned: reusable auth events are passed as `Set<SignedEvent>` via `authEvents` and only mutated by auth helper functions in `src/auth.ts` and action modules.
- Runtime code targets both Node and browser environments through DOM lib types, `Blob`/`File`/`Buffer` support, global `fetch`, browser media helpers, and HLS adapter exports.

## Layers

**Public API Layer:**
- Purpose: Define import surfaces consumed by package users.
- Location: `src/index.ts`, `src/actions/index.ts`, `src/helpers/index.ts`, `package.json`
- Contains: Barrel exports, root `Actions` namespace export, package subpath export declarations.
- Depends on: Source modules under `src/` and generated build output under `lib/`.
- Used by: Consumers importing `blossom-client-sdk`, `blossom-client-sdk/media`, `blossom-client-sdk/hls`, `blossom-client-sdk/helpers`, `blossom-client-sdk/nostr`, `blossom-client-sdk/auth`, and `blossom-client-sdk/actions/*`.

**Action Layer:**
- Purpose: Implement Blossom HTTP behaviors and retries.
- Location: `src/actions/`
- Contains: `uploadBlob`, `downloadBlob`, `listBlobs`, `iterateBlobs`, `deleteBlob`, `hasBlob`, `mirrorBlob`, `uploadMedia`, `multiServerUpload`, `multiServerMediaUpload`, `resolveBlob`, `getBlobUrls`, `resolveToObjectURL`, and `reportBlobs`.
- Depends on: `src/auth.ts`, `src/error.ts`, `src/types.ts`, `src/helpers/*.ts`, global `fetch`, optional `@cashu/cashu-ts`.
- Used by: Root exports in `src/index.ts`, browser helpers in `src/media.ts`, and SDK consumers.

**Auth Layer:**
- Purpose: Create, encode, match, and reuse Nostr authorization events.
- Location: `src/auth.ts`
- Contains: Kind `24242` auth event builders, expiration checks, server tag normalization, authorization header encoding, reusable auth store helpers.
- Depends on: `src/const.ts`, `src/types.ts`, `src/helpers/blob.ts`, `src/helpers/url.ts`.
- Used by: Auth-aware actions in `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/delete.ts`, `src/actions/mirror.ts`, `src/actions/media.ts`, and orchestration in `src/actions/multi-server.ts`.

**Helper Layer:**
- Purpose: Provide reusable pure or near-pure support routines for hashing, URL parsing, timeout handling, Cashu payment request decoding, and server normalization.
- Location: `src/helpers/`
- Contains: Small focused modules with named exports and a helper barrel.
- Depends on: `@noble/hashes` for hex encoding and fallback SHA-256, optional dynamic `@cashu/cashu-ts`, platform globals (`crypto`, `URL`, `AbortController`).
- Used by: Action modules, auth core, media helpers, and direct consumer imports.

**Adapter Layer:**
- Purpose: Adapt SDK resolution/fallback logic to browser DOM media and `hls.js` loader extension points.
- Location: `src/media.ts`, `src/hls.ts`
- Contains: DOM fallback listeners, mutation observer management, source element creation, HLS loader class factory.
- Depends on: Browser DOM globals, `src/actions/resolve.ts`, `src/helpers/blossom-uri.ts`, `src/helpers/url.ts`, `hls.js` types.
- Used by: Browser consumers via root export and `./media` / `./hls` subpath exports.

**Build/Test/Release Layer:**
- Purpose: Compile source, validate behavior, generate docs, and publish releases.
- Location: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/test.yml`, `.github/workflows/version-or-publish.yml`, `typedoc.json`
- Contains: TypeScript NodeNext compilation, Vitest node/browser configuration, GitHub Actions workflows, TypeDoc configuration, Changesets release workflow.
- Depends on: `pnpm`, TypeScript, Vitest, Playwright, Changesets, TypeDoc.
- Used by: Maintainers and CI.

## Data Flow

### Upload Request Path

1. Consumer calls `uploadBlob(server, blob, opts)` (`src/actions/upload.ts:34`).
2. SDK builds `/upload` URL and computes SHA-256 with `getBlobSha256(blob)` (`src/actions/upload.ts:39`, `src/helpers/blob.ts:13`).
3. SDK sends `HEAD /upload` with `X-SHA-256`, `X-Content-Length`, and optional `X-Content-Type` preflight headers (`src/actions/upload.ts:67`).
4. On `401`, SDK resolves a reusable or callback-created auth event via `getReusableAuthEvent` / `opts.onAuth`, encodes it with `encodeAuthorizationHeader`, and retries `PUT /upload` (`src/actions/upload.ts:95`, `src/auth.ts:17`, `src/auth.ts:91`).
5. On `402`, SDK dynamically imports `@cashu/cashu-ts` and `getPaymentRequestFromHeaders`, asks `opts.onPayment` for a token, and retries `PUT /upload` with `X-Cashu` (`src/actions/upload.ts:114`, `src/helpers/cashu.ts:4`).
6. Successful upload response is parsed as `BlobDescriptor`; failed responses are converted to `HTTPError` through `HTTPError.handleErrorResponse` (`src/actions/upload.ts:147`, `src/error.ts:29`).

### Download/List/Delete/Mirror Request Path

1. Consumer calls a specific action: `downloadBlob`, `listBlobs`, `deleteBlob`, or `mirrorBlob` (`src/actions/download.ts:32`, `src/actions/list.ts:34`, `src/actions/delete.ts:32`, `src/actions/mirror.ts:34`).
2. Each action constructs a Blossom endpoint URL (`/<sha256>`, `/list/<pubkey>`, or `/mirror`) with `new URL()` (`src/actions/download.ts:33`, `src/actions/list.ts:39`, `src/actions/delete.ts:33`, `src/actions/mirror.ts:39`).
3. Each action sends an initial request with preset auth if supplied, then handles `401` and `402` by retrying with authorization or payment headers (`src/actions/download.ts:64`, `src/actions/list.ts:69`, `src/actions/delete.ts:65`, `src/actions/mirror.ts:78`).
4. Responses are either returned directly (`downloadBlob`), parsed as JSON (`listBlobs`, `mirrorBlob`), or reduced to boolean success (`deleteBlob`) (`src/actions/download.ts:106`, `src/actions/list.ts:108`, `src/actions/mirror.ts:121`, `src/actions/delete.ts:107`).

### Multi-Server Upload Flow

1. Consumer calls `multiServerUpload(servers, blob, opts)` (`src/actions/multi-server.ts:97`).
2. SDK merges defaults (`mirrorTimeout: 5000`, `preflight: true`), prepares a local or caller-provided auth event `Set`, and computes the blob hash (`src/actions/multi-server.ts:68`, `src/actions/multi-server.ts:102`, `src/actions/multi-server.ts:105`).
3. When preflight is enabled, SDK performs parallel `hasBlob(server, sha256)` checks with `Promise.allSettled` (`src/actions/multi-server.ts:138`, `src/actions/has.ts:12`).
4. For each server, SDK prefers `mirrorBlob` when an initial upload exists or preflight says the server already has the blob; otherwise it uses `uploadBlob` (`src/actions/multi-server.ts:165`, `src/actions/multi-server.ts:177`, `src/actions/multi-server.ts:190`).
5. Shared auth resolution is centralized in a local `handleAuthRequest` that checks/stores reusable events via `src/auth.ts` helpers (`src/actions/multi-server.ts:110`).
6. Results are accumulated in `Map<S, BlobDescriptor>`, callbacks are invoked per server, and known BUD rejection errors can be skipped or cancel the flow (`src/actions/multi-server.ts:125`, `src/actions/multi-server.ts:205`).

### Multi-Server Media Upload Flow

1. Consumer calls `multiServerMediaUpload(servers, blob, opts)` (`src/actions/multi-server.ts:235`).
2. SDK attempts one `/media` upload using the first server or any server based on `mediaUploadBehavior` (`src/actions/multi-server.ts:274`).
3. `uploadMedia` does `HEAD /media`, treats `404` as `MediaEndpointMissingError`, and uses the same auth/payment retry pattern as regular upload (`src/actions/media.ts:57`, `src/actions/media.ts:66`, `src/actions/media.ts:71`).
4. If `/media` is unavailable and `mediaUploadFallback` is true, SDK delegates to `multiServerUpload`; otherwise it throws (`src/actions/multi-server.ts:308`).
5. After a successful optimized upload, SDK mirrors the optimized `BlobDescriptor` to remaining servers and optionally preflights those servers with the optimized SHA-256 (`src/actions/multi-server.ts:318`).

### Blossom URI Resolution Flow

1. Consumer passes a `blossom:` URI string, `URL`, or parsed `BlossomURI` to `getBlobUrls`, `resolveBlob`, or `resolveToObjectURL` (`src/actions/resolve.ts:69`, `src/actions/resolve.ts:92`, `src/actions/resolve.ts:152`).
2. SDK normalizes input using `parseInput`, which delegates to `parseBlossomURI` or `blossomURIFromURL` (`src/actions/resolve.ts:27`, `src/helpers/blossom-uri.ts:17`, `src/helpers/blossom-uri.ts:73`).
3. Server candidates are collected and deduplicated from `xs` hints, author hints through `opts.getServers`, and `fallbackServers` (`src/actions/resolve.ts:35`, `src/actions/resolve.ts:74`, `src/actions/resolve.ts:78`, `src/actions/resolve.ts:85`).
4. `resolveBlob` sequentially fetches candidate URLs until one response is OK, swallowing unreachable-server errors and continuing (`src/actions/resolve.ts:96`).

**State Management:**
- There is no application store or class-level singleton for normal actions; state is held in local variables, callback parameters, response objects, and return values.
- Reusable authorization state is an explicit `Set<SignedEvent>` passed as `opts.authEvents` to action functions (`src/actions/upload.ts:12`, `src/actions/download.ts:12`, `src/actions/list.ts:12`, `src/actions/delete.ts:12`, `src/actions/mirror.ts:12`, `src/actions/media.ts:22`).
- Blob hash caching is stored on individual `Blob`/`File`/`Buffer` objects using `BlobHashSymbol = Symbol.for("sha256")` (`src/helpers/blob.ts:9`).
- Browser media fallback state is held in closure variables and a `Map<MediaElement, () => void>` owned by `handleBrokenMedia` (`src/media.ts:24`, `src/media.ts:127`).
- HLS failover health is held in a closure-local `Map<string, number>` inside `createBlossomHlsLoaders` (`src/hls.ts:92`).

## Key Abstractions

**SignedEvent / EventTemplate / Signer:**
- Purpose: Represent Nostr event drafts, signed events, and callback-based signing.
- Examples: `src/types.ts`, `src/auth.ts`
- Pattern: Structural TypeScript types used by callbacks and helpers; signing is delegated to caller-supplied `Signer` functions.

**AuthRequest and AuthType:**
- Purpose: Describe the server/action/blob tuple needed to match reusable auth events.
- Examples: `src/auth.ts`, `src/actions/upload.ts`, `src/actions/multi-server.ts`
- Pattern: Auth matching is centralized in `doesAuthMatchRequest`; actions only provide request context and callback hooks.

**Action Options Types:**
- Purpose: Give every operation an explicit options contract for `signal`, `timeout`, auth control, payment callbacks, and lifecycle callbacks.
- Examples: `UploadOptions` in `src/actions/upload.ts`, `DownloadOptions` in `src/actions/download.ts`, `MultiServerUploadOptions` in `src/actions/multi-server.ts`
- Pattern: Export `<Operation>Options<S>` or `<Operation>Options<S, B>` next to the function that consumes it.

**BlobDescriptor:**
- Purpose: Represent server-returned blob metadata after upload, mirror, list, and media operations.
- Examples: `src/types.ts`, `src/actions/upload.ts`, `src/actions/mirror.ts`, `src/actions/list.ts`
- Pattern: Common DTO passed between upload and mirror flows; multi-server code reuses initial descriptors as mirror sources.

**PaymentRequest / PaymentToken:**
- Purpose: Preserve Cashu payment integration types without requiring `@cashu/cashu-ts` as a hard runtime dependency.
- Examples: `src/types.ts`, `src/helpers/cashu.ts`, `src/actions/upload.ts`, `src/actions/download.ts`
- Pattern: Structural copies in `src/types.ts`; runtime Cashu functions loaded only inside `402` branches.

**BlossomURI:**
- Purpose: Model `blossom:` URI fields including hash, extension, server hints, author hints, and optional expected size.
- Examples: `src/helpers/blossom-uri.ts`, `src/actions/resolve.ts`, `src/media.ts`
- Pattern: Parse/build helpers keep URI validation outside action orchestration.

**HTTPError:**
- Purpose: Carry failed `Response`, status, user-facing message, and known BUD rejection code.
- Examples: `src/error.ts`, `src/actions/multi-server.ts`
- Pattern: Central class with static `handleErrorResponse` and `isRejection` guard; action modules call it after final retries.

**HLS Loader Factory:**
- Purpose: Produce `hls.js` playlist and fragment loader classes that try alternate server origins.
- Examples: `src/hls.ts`
- Pattern: Factory returns classes that wrap a configured base loader while sharing closure-local fallback options and penalties.

## Entry Points

**Package Root:**
- Location: `src/index.ts`
- Triggers: Consumer imports from `blossom-client-sdk`.
- Responsibilities: Expose constants, auth utilities, helpers, media utilities, Nostr utilities, HTTP error, shared types, and the `Actions` namespace.

**Actions Barrel:**
- Location: `src/actions/index.ts`
- Triggers: Consumer imports from action namespace or package action subpaths.
- Responsibilities: Re-export all action modules for upload, mirror, list, delete, download, has, resolve, multi-server, media, and report behavior.

**Helpers Barrel:**
- Location: `src/helpers/index.ts`
- Triggers: Consumer imports from root, `blossom-client-sdk/helpers`, or internal action imports.
- Responsibilities: Re-export blob, Blossom URI, Cashu, fetch, signal, and URL helpers.

**Media Subpath:**
- Location: `src/media.ts`
- Triggers: Browser consumers importing `blossom-client-sdk/media` or root exports.
- Responsibilities: Resolve broken media sources, observe DOM mutations, and create `<source>` elements.

**HLS Subpath:**
- Location: `src/hls.ts`
- Triggers: Browser consumers importing `blossom-client-sdk/hls` and passing loaders to `hls.js` configuration.
- Responsibilities: Provide failover playlist and fragment loader constructors.

**Build Entry:**
- Location: `tsconfig.json`, `package.json`
- Triggers: `pnpm build` / `tsc`.
- Responsibilities: Compile `src/` to `lib/` with declarations using NodeNext ESM settings.

**Test Entry:**
- Location: `vitest.config.ts`, `.github/workflows/test.yml`
- Triggers: `pnpm test`, `pnpm vitest run`, and CI jobs.
- Responsibilities: Run Node tests by default and browser tests with Playwright/Chromium when requested.

## Architectural Constraints

- **Threading:** The SDK uses the single-threaded JavaScript event loop; concurrency is explicit through async operations and `Promise.allSettled` in `src/actions/multi-server.ts`.
- **Global state:** Avoid module-level mutable state except constants and symbols. Mutable shared state appears as caller-owned `Set<SignedEvent>` passed through action options (`src/auth.ts`, `src/actions/*.ts`), per-object hash cache via `BlobHashSymbol` (`src/helpers/blob.ts`), DOM listener maps in `src/media.ts`, and HLS penalty maps inside `createBlossomHlsLoaders` (`src/hls.ts`).
- **Circular imports:** `src/types.ts` imports option types from `src/actions/delete.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/mirror.ts`, and `src/actions/upload.ts`; those action modules import runtime/data types back from `src/types.ts`. Keep these imports type-only when adding new cross references to avoid runtime cycles.
- **ESM import extensions:** Source files import local modules using `.js` extensions because TypeScript uses `module: NodeNext` and emits ESM (`tsconfig.json`, `src/index.ts`, `src/actions/upload.ts`). New local imports must use `.js` suffixes.
- **Runtime APIs:** Core action modules assume global `fetch`, `URL`, `Headers`, `Blob`, and `AbortController`; browser adapter modules require DOM globals (`src/media.ts`, `src/hls.ts`). Keep Node-compatible code out of DOM-only entrypoints unless guarded.
- **Optional peers:** `@cashu/cashu-ts` and `hls.js` are optional peer dependencies in `package.json`; Cashu runtime imports must stay inside payment branches, and `hls.js` imports in `src/hls.ts` must stay type-only unless a hard dependency is intended.
- **Build output:** `lib/` is generated by `pnpm build`; change source files in `src/` and allow TypeScript to emit `lib/`.

## Anti-Patterns

### Adding Auth Logic Directly Inside New Actions

**What happens:** New action functions can duplicate ad hoc auth event matching or header building.
**Why it's wrong:** Duplicate auth logic can miss expiration pruning, server normalization, and reusable event storage handled by `src/auth.ts`.
**Do this instead:** Reuse `getReusableAuthEvent`, `storeAuthEvent`, and `encodeAuthorizationHeader` from `src/auth.ts`, following `src/actions/upload.ts` and `src/actions/download.ts`.

### Importing Optional Peer Dependencies at Module Top Level

**What happens:** Adding `import { ... } from "@cashu/cashu-ts"` or value imports from `hls.js` at top level makes optional peers mandatory.
**Why it's wrong:** `package.json` marks `@cashu/cashu-ts` and `hls.js` as optional peer dependencies, so consumers should not need them unless using related flows.
**Do this instead:** Use dynamic imports inside payment branches as in `src/actions/upload.ts` and `src/helpers/cashu.ts`, or use `import type` for HLS contracts as in `src/hls.ts`.

### Skipping `fetchWithTimeout` in Server Actions

**What happens:** Direct `fetch` calls in action modules do not honor the shared `timeout` option pattern.
**Why it's wrong:** Action options consistently expose `timeout`; bypassing `fetchWithTimeout` causes inconsistent cancellation behavior.
**Do this instead:** Use `fetchWithTimeout` from `src/helpers/fetch.ts` for HTTP action modules, following `src/actions/upload.ts`, `src/actions/download.ts`, and `src/actions/multi-server.ts`. DOM/browser-specific code in `src/media.ts` can remain tied to browser event behavior.

### Adding New Public Files Without Export Wiring

**What happens:** A module is added under `src/` but not re-exported from the correct barrel or `package.json` subpath.
**Why it's wrong:** Consumers import through package exports and barrels; unexported files are not part of the intended public API.
**Do this instead:** Add action modules to `src/actions/index.ts`, helper modules to `src/helpers/index.ts`, root utilities to `src/index.ts`, and package subpaths to `package.json` when public direct imports are intended.

## Error Handling

**Strategy:** Actions perform request-specific retries for auth and payment, then route final non-OK responses through `HTTPError.handleErrorResponse`; orchestration layers catch per-server errors and expose callback-based control.

**Patterns:**
- Throw `Error` for local configuration failures such as missing `onAuth`, disabled authorization, missing `onPayment`, unavailable `/media`, or no resolvable servers (`src/actions/upload.ts`, `src/actions/media.ts`, `src/actions/resolve.ts`).
- Use `HTTPError` for server non-OK responses after all supported retries (`src/error.ts`, `src/actions/upload.ts`, `src/actions/mirror.ts`).
- Use `HTTPError.isRejection` in multi-server flows to classify known BUD rejection statuses and decide skip/cancel behavior (`src/actions/multi-server.ts`).
- Swallow unreachable-server errors only in resolution/fallback loops that intentionally try alternatives (`src/actions/resolve.ts`, `src/media.ts`, `src/hls.ts`).
- Re-throw abort and timeout errors in reporting so caller cancellation is preserved (`src/actions/report.ts`).

## Cross-Cutting Concerns

**Logging:** Minimal logging; `src/media.ts` uses `console.warn` when it cannot find a pubkey for a broken media element. Server action modules report through callbacks such as `onError`, `onStart`, `onUpload`, and `onFallback` rather than logging.
**Validation:** SHA-256 and Blossom URI validation lives in `src/helpers/blob.ts` and `src/helpers/blossom-uri.ts`; report event validation lives in `src/actions/report.ts`; auth request matching lives in `src/auth.ts`; HTTP rejection classification lives in `src/error.ts`.
**Authentication:** Nostr auth is callback-driven. Callers provide `Signer` / `onAuth` callbacks; SDK creates or receives signed kind `24242` events, encodes them as `Authorization: Nostr ...`, and can reuse non-expired events through `authEvents` sets (`src/auth.ts`, `src/actions/*.ts`).

---

*Architecture analysis: 2026-07-25*
