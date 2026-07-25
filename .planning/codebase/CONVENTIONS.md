# Coding Conventions

**Analysis Date:** 2026-07-25

## Naming Patterns

**Files:**
- Use kebab-case for multi-word modules: `src/helpers/blossom-uri.ts`, `src/actions/multi-server.ts`, `tests/actions/get-blob-urls.test.ts`.
- Keep one public module per source file under `src/`; match test paths under `tests/` where practical, e.g. `src/actions/upload.ts` is covered by `tests/actions/upload.test.ts`.
- Use `index.ts` files only as re-export entrypoints: `src/index.ts`, `src/actions/index.ts`, `src/helpers/index.ts`.

**Functions:**
- Use camelCase verbs for exported functions: `uploadBlob()` in `src/actions/upload.ts`, `createAuthEvent()` in `src/auth.ts`, `fetchWithTimeout()` in `src/helpers/fetch.ts`.
- Boolean/query helpers use predicate-style names: `isSha256()` in `src/helpers/blob.ts`, `areServersEqual()` in `src/helpers/url.ts`, `doesAuthMatchRequest()` in `src/auth.ts`, `hasBlob()` in `src/actions/has.ts`.
- Callback options use `onX` names: `onAuth`, `onPayment`, `onError`, `onStart`, `onUpload`, and `onRejection` in `src/actions/upload.ts` and `src/actions/multi-server.ts`.

**Variables:**
- Use camelCase for locals and parameters: `mockServer`, `mockBlob`, `mockSha256` in `tests/actions/upload.test.ts`; `initialUpload`, `authEvents`, `blobSha256` in `src/actions/multi-server.ts`.
- Use SCREAMING_SNAKE_CASE for constants that represent protocol-level values: `AUTH_EVENT_KIND` in `src/const.ts` and `USER_BLOSSOM_SERVER_LIST_KIND` in `src/nostr.ts`.
- Use descriptive option bags named `opts` at API boundaries and normalized `options` after defaults: `uploadBlob(server, blob, opts)` in `src/actions/upload.ts`; `const options = { ...defaultMultiServerOptions, ...opts }` in `src/actions/multi-server.ts`.

**Types:**
- Use PascalCase for exported types and classes: `UploadOptions`, `MultiServerUploadOptions`, `BlobDescriptor`, `HTTPError`, `TimeoutError`.
- Name option types after their owning function: `UploadOptions` in `src/actions/upload.ts`, `ListOptions` in `src/actions/list.ts`, `DownloadOptions` in `src/actions/download.ts`.
- Use generic names that encode role when APIs preserve caller-specific types: `S extends ServerType`, `B extends UploadType` in `src/actions/upload.ts`; `TServer`, `TUpload` in `src/actions/multi-server.ts`.

## Code Style

**Formatting:**
- Tool: Prettier via `pnpm format` from `package.json`.
- Settings: `.prettierrc` sets `tabWidth: 2`, `useTabs: false`, and `printWidth: 120`.
- Use semicolons and double quotes, matching `src/auth.ts`, `src/actions/upload.ts`, and all test files.
- Prefer compact one-line branches only for simple guards, e.g. `if (reused) return reused;` in `src/actions/upload.ts` and `if (!res.ok)` guard blocks in `src/error.ts`.

**Linting:**
- No ESLint or Biome config detected; there is no lint script in `package.json`.
- TypeScript strictness is the quality gate: `tsconfig.json` enables `strict`, `noImplicitAny`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- Preserve ESM/NodeNext compatibility: source imports use explicit `.js` extensions for relative runtime imports, e.g. `src/auth.ts` imports `./types.js` and `src/actions/upload.ts` imports `../error.js`.

## Import Organization

**Order:**
1. External packages first: `vitest`, `@cashu/cashu-ts`, `nostr-tools`, `@noble/hashes` as in `tests/actions/upload.test.ts` and `tests/auth.test.ts`.
2. Internal source imports next, using relative paths from the test or module: `../../src/actions/upload.js`, `../src/auth.js`, `../helpers/index.js`.
3. Test support imports last in tests: `fetchMock` from `tests/fetch.ts`, mock server classes from `tests/mock-servers.ts`.

**Path Aliases:**
- No path aliases are configured in `tsconfig.json`; use relative imports.
- Public source imports should include `.js` extensions for emitted ESM compatibility, as in `src/index.ts`, `src/auth.ts`, and `src/helpers/fetch.ts`.
- Tests include a mix of `.js`-suffixed and extensionless imports (`tests/actions/multi-server.test.ts`, `tests/media.test.ts`); for new code, prefer `.js` suffixes when importing source modules to match NodeNext output.

## Error Handling

**Patterns:**
- Use `HTTPError.handleErrorResponse(response)` after fetch responses that should fail on non-2xx statuses; `src/actions/upload.ts` calls it before returning JSON.
- Throw ordinary `Error` for missing user-provided handlers or invalid input: `Missing auth handler` in `src/actions/upload.ts`, `Missing payment handler` in `src/actions/delete.ts`, invalid blossom URI errors in `src/helpers/blossom-uri.ts`.
- Use custom error classes when callers need type discrimination: `HTTPError` in `src/error.ts`, `MediaEndpointMissingError` in `src/actions/media.ts`, and `TimeoutError` in `src/helpers/signal.ts`.
- For multi-server operations, catch per-server errors and report through callbacks instead of aborting the whole operation: `multiServerUpload()` and `multiServerMediaUpload()` call `options.onError?.(...)` in `src/actions/multi-server.ts`.
- For known BUD rejection statuses, use `HTTPError.isRejection(error)` and `onRejection` to choose `skip` or `cancel` behavior in `src/actions/multi-server.ts`.

## Logging

**Framework:** console

**Patterns:**
- Logging is minimal; do not add broad debug logging to library functions.
- Use `console.warn` only for browser-facing recoverable diagnostics, as in `src/media.ts` when a broken media element has no discoverable pubkey.
- Prefer callback reporting (`onError`, `onRejection`) over console output for action-layer failures in `src/actions/multi-server.ts`.

## Comments

**When to Comment:**
- Add concise comments for protocol steps and fallback branches: `HEAD /upload` checks in `src/actions/upload.ts`, preflight and mirror phases in `src/actions/multi-server.ts`, DOM mutation handling in `src/media.ts`.
- Include compatibility comments for non-obvious runtime checks, such as Node 18 `File` detection in `src/helpers/blob.ts` and browser error filtering in `tests/media.test.ts`.
- Do not comment obvious assignments; use comments to explain Blossom/BUD/Nostr protocol behavior or asynchronous control flow.

**JSDoc/TSDoc:**
- Exported functions and option callbacks commonly have JSDoc: `uploadBlob()` and `UploadOptions` in `src/actions/upload.ts`, auth helpers in `src/auth.ts`, media helpers in `src/media.ts`.
- Public option types should document callback parameters, defaults, and behavior, following `MultiServerUploadOptions` in `src/actions/multi-server.ts`.
- Mermaid diagrams are acceptable in TSDoc for complex public flows, as shown in `src/actions/multi-server.ts`.

## Function Design

**Size:** Keep simple helpers small (`src/helpers/fetch.ts`, `src/helpers/signal.ts`, `src/helpers/url.ts`). Larger orchestration functions are acceptable when they encode a complete protocol flow, as in `src/actions/multi-server.ts`, but structure them with local helper closures and phase comments.

**Parameters:** Prefer `(server, resource, opts?)` for action APIs: `uploadBlob(server, blob, opts)` in `src/actions/upload.ts`, `deleteBlob(server, hash, opts)` in `src/actions/delete.ts`, `multiServerUpload(servers, blob, opts)` in `src/actions/multi-server.ts`.

**Return Values:** Return parsed domain objects for successful HTTP actions (`BlobDescriptor` from `uploadBlob()` in `src/actions/upload.ts`), `Map<server, BlobDescriptor>` for multi-server uploads in `src/actions/multi-server.ts`, and cleanup functions for DOM listener APIs in `src/media.ts`.

## Module Design

**Exports:**
- Export public functions and types directly from their implementation modules, then re-export through entrypoint files.
- Root exports in `src/index.ts` flatten core modules and expose action functions under the `Actions` namespace; do not assume every action is flattened onto the root export.
- Keep action implementations in `src/actions/*.ts`; shared helpers belong under `src/helpers/*.ts`; protocol/auth logic belongs in `src/auth.ts` and `src/nostr.ts`.

**Barrel Files:**
- Use barrel files for public module surfaces: `src/index.ts`, `src/actions/index.ts`, and `src/helpers/index.ts`.
- Do not put business logic in barrel files; `src/index.ts` contains exports only.

---

*Convention analysis: 2026-07-25*
