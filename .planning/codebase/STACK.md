# Technology Stack

**Analysis Date:** 2026-07-25

## Languages

**Primary:**
- TypeScript 5.8.3 - source for the ESM library in `src/**/*.ts`; compiled declarations and JavaScript are emitted to `lib/` by `pnpm build` using `tsconfig.json`.

**Secondary:**
- JavaScript ESM - published runtime output in `lib/**/*.js` and README examples in `README.md`.
- JSON/YAML - package metadata in `package.json`, TypeScript and docs config in `tsconfig.json` and `typedoc.json`, Changesets config in `.changeset/config.json`, GitHub Actions in `.github/workflows/*.yml`.

## Runtime

**Environment:**
- Node.js >=18 - declared in `package.json` `engines.node`; CI runs Node `18.x`, `20.x`, `22.x`, and `24.x` in `.github/workflows/test.yml`.
- Browser/Web API runtime - library uses `fetch`, `Blob`, `File`, `Headers`, `Response`, `crypto.subtle`, `TextEncoder`, `btoa`, `URL`, DOM media elements, and `MutationObserver` in `src/helpers/fetch.ts`, `src/helpers/blob.ts`, `src/auth.ts`, and `src/media.ts`.
- ESM only - `package.json` sets `type: "module"`; all source imports use `.js` specifiers such as `src/index.ts` and `src/actions/upload.ts`.

**Package Manager:**
- pnpm 10.10.0 - declared in `package.json` `packageManager`.
- Lockfile: present at `pnpm-lock.yaml`.

## Frameworks

**Core:**
- TypeScript compiler (`typescript` ^5.8.3) - builds `src/` to `lib/` with declarations via `tsc` in `package.json` script `build` and `tsconfig.json`.
- Native Fetch/Web APIs - HTTP client layer uses global `fetch` instead of axios or a framework in `src/helpers/fetch.ts` and `src/actions/*.ts`.
- hls.js (`hls.js` ^1.6.16 optional peer) - `src/hls.ts` provides hls.js playlist and fragment loader constructors with Blossom fallback behavior.

**Testing:**
- Vitest ^3.1.3 - node test runner configured in `vitest.config.ts` and executed by `package.json` script `test`.
- @vitest/browser ^3.1.3 with Playwright ^1.52.0 - browser test provider configured in `vitest.config.ts`; CI installs Chromium and runs browser tests in `.github/workflows/test.yml`.
- @vitest/coverage-v8 ^3.1.3 - coverage provider used by `package.json` script `coverage`.
- vitest-fetch-mock ^0.4.5 - fetch mocking support used by HTTP-facing tests under `tests/`.

**Build/Dev:**
- Prettier ^3.5.3 - formatting command `pnpm format` in `package.json`; settings in `.prettierrc` use 2 spaces and `printWidth` 120.
- TypeDoc ^0.25.13 with `typedoc-plugin-mermaid` ^1.12.0 - documentation generation via `pnpm docs`; plugin configured in `typedoc.json`.
- Changesets ^2.29.3 - release versioning configured in `.changeset/config.json` and published by `.github/workflows/version-or-publish.yml`.

## Key Dependencies

**Critical:**
- `@noble/hashes` ^1.8.0 - required dependency for SHA-256 hashing fallback and hex encoding in `src/helpers/blob.ts`.
- `@cashu/cashu-ts` ^2.4.3 - optional peer dependency for Cashu payment requests/tokens; dynamically imported in `src/helpers/cashu.ts` and payment branches in `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/mirror.ts`, `src/actions/delete.ts`, and `src/actions/media.ts`.
- `hls.js` ^1.6.16 - optional peer dependency consumed as types in `src/hls.ts`; users must install it for `blossom-client-sdk/hls`.

**Infrastructure:**
- `nostr-tools` ^2.12.0 - dev/test dependency used in tests for signing Nostr events; production code accepts a `Signer` callback type from `src/types.ts` instead of depending on a specific Nostr client.
- `@testing-library/dom` ^10.4.0 - browser/DOM test utilities for media helper tests under `tests/media.test.ts`.
- GitHub Actions - CI, release, and docs deployment are defined in `.github/workflows/test.yml`, `.github/workflows/version-or-publish.yml`, and `.github/workflows/page.yml`.

## Configuration

**Environment:**
- No runtime `.env` files detected; application code does not read `process.env` or `import.meta.env`.
- Runtime server endpoints are provided by consumers as `string | URL` arguments (`ServerType` in `src/types.ts`) to action functions in `src/actions/*.ts`.
- Auth signing is configured by consumer-provided `Signer` callbacks (`src/types.ts`) and `onAuth` hooks in action options such as `src/actions/upload.ts` and `src/actions/download.ts`.
- Payment handling is configured by consumer-provided `onPayment` hooks returning Cashu tokens in `src/actions/*.ts`.

**Build:**
- `tsconfig.json` targets `ES2022`, uses `NodeNext` module resolution, includes `DOM` libs, emits declarations, and compiles from `src/` to `lib/`.
- `package.json` exports root, `./media`, `./hls`, `./helpers`, `./helpers/*`, `./nostr`, `./auth`, `./actions`, and `./actions/*` subpaths.
- `typedoc.json` configures the Mermaid plugin for generated API docs.
- `.prettierrc` configures formatting.
- `vitest.config.ts` configures node tests, browser provider, Chromium instance, and coverage include paths.

## Platform Requirements

**Development:**
- Use pnpm 10.10.0 with Node >=18 (`package.json`).
- Run `pnpm install`, `pnpm test`, `pnpm build`, `pnpm coverage`, and `pnpm docs` from the repository root.
- Run browser tests with `pnpm vitest run --browser --browser.headless` after `pnpm exec playwright install` when touching DOM/media helpers in `src/media.ts` or HLS browser-facing behavior in `src/hls.ts`.

**Production:**
- Published package is an ESM npm library named `blossom-client-sdk` with files from `lib/` and `src/` (`package.json`).
- Consumers need Node >=18 or a browser/runtime that provides the required Web APIs.
- Consumers using Cashu payments must install `@cashu/cashu-ts`; consumers using HLS fallback loaders must install `hls.js` (`package.json` peer dependencies).
- Release publishing targets npm through Changesets in `.github/workflows/version-or-publish.yml`; docs deployment targets GitHub Pages in `.github/workflows/page.yml`.

---

*Stack analysis: 2026-07-25*
