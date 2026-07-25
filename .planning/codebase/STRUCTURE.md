# Codebase Structure

**Analysis Date:** 2026-07-25

## Directory Layout

```text
blossom-client-sdk/
├── src/                    # TypeScript source for the published SDK
│   ├── actions/            # Blossom HTTP action functions and orchestration
│   ├── helpers/            # Reusable hashing, URI, URL, fetch, signal, and Cashu helpers
│   ├── auth.ts             # Nostr auth event creation, encoding, matching, and reuse
│   ├── const.ts            # Shared constants such as auth event kind
│   ├── error.ts            # HTTPError and BUD rejection classification
│   ├── hls.ts              # hls.js failover loader factory
│   ├── index.ts            # Root public source entrypoint
│   ├── media.ts            # Browser DOM media fallback utilities
│   ├── nostr.ts            # Nostr server-list helpers
│   └── types.ts            # Shared public TypeScript types
├── tests/                  # Vitest test suite and fetch/server test helpers
│   └── helpers/            # Helper-specific tests
├── lib/                    # Generated JavaScript and declaration output from `pnpm build`
│   ├── actions/            # Generated action modules
│   └── helpers/            # Generated helper modules
├── .github/workflows/      # CI, docs publication, and release workflows
├── .changeset/             # Changesets release configuration
├── .planning/codebase/     # GSD-generated codebase maps
├── package.json            # Package metadata, exports, scripts, dependencies, pnpm version
├── pnpm-lock.yaml          # pnpm dependency lockfile
├── tsconfig.json           # TypeScript NodeNext ESM build configuration
├── vitest.config.ts        # Node and browser Vitest configuration
├── typedoc.json            # TypeDoc plugin configuration
├── .prettierrc             # Prettier formatting configuration
├── AGENTS.md               # Repository-specific agent instructions
├── README.md               # User-facing package documentation and examples
├── CHANGELOG.md            # Release notes
└── LICENSE.txt             # MIT license
```

## Directory Purposes

**`src/`:**
- Purpose: Authoritative TypeScript source for the SDK.
- Contains: Public entrypoints, action modules, helpers, auth utilities, error types, browser adapters, and shared types.
- Key files: `src/index.ts`, `src/auth.ts`, `src/types.ts`, `src/error.ts`, `src/media.ts`, `src/hls.ts`, `src/nostr.ts`.

**`src/actions/`:**
- Purpose: Implement all Blossom server operations and multi-server orchestration.
- Contains: One module per operation plus an action barrel.
- Key files: `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/list.ts`, `src/actions/delete.ts`, `src/actions/mirror.ts`, `src/actions/media.ts`, `src/actions/multi-server.ts`, `src/actions/resolve.ts`, `src/actions/report.ts`, `src/actions/has.ts`, `src/actions/index.ts`.

**`src/helpers/`:**
- Purpose: Provide reusable lower-level utilities used by action, auth, media, and consumer code.
- Contains: Hashing/blob helpers, Blossom URI parsing/building, Cashu payment header decoding, timeout-enabled fetch wrapper, AbortSignal timeout wrapping, URL normalization/hash extraction, helper barrel.
- Key files: `src/helpers/blob.ts`, `src/helpers/blossom-uri.ts`, `src/helpers/cashu.ts`, `src/helpers/fetch.ts`, `src/helpers/signal.ts`, `src/helpers/url.ts`, `src/helpers/index.ts`.

**`tests/`:**
- Purpose: Validate SDK behavior with Vitest in Node and browser modes.
- Contains: Unit/integration tests for auth, Nostr helpers, errors, fetch helpers, media/HLS behavior, mock servers, and fetch mock setup.
- Key files: `tests/auth.test.ts`, `tests/nostr.test.ts`, `tests/error.test.ts`, `tests/mock-servers.ts`, `tests/helpers/fetch.test.ts`.

**`lib/`:**
- Purpose: Generated publishable output emitted by TypeScript.
- Contains: `.js` ESM modules and `.d.ts` declarations mirroring `src/`.
- Key files: `lib/index.js`, `lib/index.d.ts`, `lib/actions/*.js`, `lib/actions/*.d.ts`, `lib/helpers/*.js`, `lib/helpers/*.d.ts`.

**`.github/workflows/`:**
- Purpose: Define CI, docs, and release automation.
- Contains: Node/browser test pipeline, TypeDoc pages workflow, Changesets release/publish workflow.
- Key files: `.github/workflows/test.yml`, `.github/workflows/page.yml`, `.github/workflows/version-or-publish.yml`.

**`.changeset/`:**
- Purpose: Configure Changesets release automation.
- Contains: Changesets config and README.
- Key files: `.changeset/config.json`, `.changeset/README.md`.

**`.planning/codebase/`:**
- Purpose: Store GSD codebase mapping documents for planning and execution agents.
- Contains: Generated architecture and structure maps.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `src/index.ts`: Root source barrel for `blossom-client-sdk` imports.
- `src/actions/index.ts`: Action barrel for `Actions` namespace and action module aggregation.
- `src/helpers/index.ts`: Helper barrel for helper subpath/root exports.
- `src/media.ts`: Browser media fallback subpath entrypoint.
- `src/hls.ts`: HLS loader subpath entrypoint.
- `package.json`: Published entrypoint and subpath export definitions.

**Configuration:**
- `package.json`: Scripts (`build`, `test`, `coverage`, `format`, `docs`), ESM mode, package exports, engines, dependencies, peer dependencies, package manager.
- `tsconfig.json`: `ES2022` / `NodeNext` TypeScript compilation from `src/` to `lib/`, strict checking, declaration output.
- `vitest.config.ts`: Vitest node environment, Playwright browser provider, coverage include pattern.
- `typedoc.json`: TypeDoc Mermaid plugin configuration.
- `.prettierrc`: Prettier formatting settings.
- `.github/workflows/test.yml`: CI test matrix for Node and browser tests.
- `.github/workflows/version-or-publish.yml`: Build and Changesets publish workflow.

**Core Logic:**
- `src/auth.ts`: Auth event builder/matcher and reusable auth store helpers.
- `src/actions/upload.ts`: Single-server upload flow.
- `src/actions/media.ts`: Single-server media upload flow.
- `src/actions/multi-server.ts`: Multi-server upload and media-upload orchestration.
- `src/actions/resolve.ts`: Blossom URI to HTTP URL resolution and response download.
- `src/error.ts`: Shared HTTP error class and rejection classification.
- `src/types.ts`: Public SDK type contracts.

**Helpers and Adapters:**
- `src/helpers/blob.ts`: SHA-256 detection/computation/cache, blob size/type helpers.
- `src/helpers/fetch.ts`: Fetch timeout wrapper.
- `src/helpers/signal.ts`: AbortSignal timeout wrapper and `TimeoutError`.
- `src/helpers/blossom-uri.ts`: Blossom URI parse/build/URL conversion helpers.
- `src/helpers/url.ts`: Server normalization and hash extraction.
- `src/helpers/cashu.ts`: Cashu payment request extraction.
- `src/media.ts`: DOM media fallback behavior.
- `src/hls.ts`: `hls.js` loader failover behavior.
- `src/nostr.ts`: Nostr kind `10063` server list parsing.

**Testing:**
- `vitest.config.ts`: Test runner configuration.
- `tests/auth.test.ts`: Auth event creation, matching, reuse, expiration, and server normalization tests.
- `tests/nostr.test.ts`: Nostr server list helper tests.
- `tests/error.test.ts`: HTTPError behavior tests.
- `tests/helpers/fetch.test.ts`: Fetch timeout helper tests.
- `tests/mock-servers.ts`: Test helpers for mock Blossom server behavior.

**Documentation and Release:**
- `README.md`: Package overview, usage examples, helper documentation, and browser helper examples.
- `typedoc.json`: Documentation build configuration.
- `.github/workflows/page.yml`: Documentation publishing workflow.
- `.changeset/config.json`: Changesets release settings.
- `CHANGELOG.md`: Published changelog.

## Naming Conventions

**Files:**
- Use lowercase kebab-case for multiword source files: `src/actions/multi-server.ts`, `src/helpers/blossom-uri.ts`.
- Use operation names for action modules: `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/delete.ts`, `src/actions/report.ts`.
- Use `index.ts` for barrel files: `src/index.ts`, `src/actions/index.ts`, `src/helpers/index.ts`.
- Use singular module names for core concepts: `src/auth.ts`, `src/error.ts`, `src/media.ts`, `src/nostr.ts`, `src/types.ts`.
- Use generated output names that mirror source names in `lib/`; do not hand-edit `lib/` files.

**Directories:**
- Use semantic top-level directories: `src/` for source, `tests/` for tests, `lib/` for generated build output, `.github/workflows/` for CI, `.changeset/` for release metadata.
- Group action functions under `src/actions/` and helper functions under `src/helpers/`.
- Keep helper tests under `tests/helpers/` when testing a helper module such as `src/helpers/fetch.ts`.

## Where to Add New Code

**New Blossom Server Action:**
- Primary code: Add `src/actions/<operation>.ts` with an exported `<Operation>Options` type and exported async function.
- Barrel export: Add `export * from "./<operation>.js";` to `src/actions/index.ts`.
- Root/public export: If root availability is intended, `src/index.ts` already exposes actions through `Actions`; add direct root exports only when the package API should flatten the new function.
- Tests: Add or extend `tests/<operation>.test.ts` or create focused tests under `tests/helpers/` for helper-only behavior.
- Pattern to follow: Use `src/actions/upload.ts` for auth/payment retry actions and `src/actions/report.ts` for multi-server best-effort actions.

**New Multi-Server Orchestration:**
- Primary code: Extend `src/actions/multi-server.ts` when orchestration combines upload/mirror/media behavior, shared auth stores, or per-server callbacks.
- Helper actions: Keep single-server primitives in separate files under `src/actions/` and call them from `src/actions/multi-server.ts`.
- Tests: Add scenarios using `tests/mock-servers.ts` and place test files under `tests/`.

**New Auth Behavior:**
- Primary code: Add auth matching/building helpers to `src/auth.ts`.
- Shared constants: Add protocol constants to `src/const.ts` when they are public or reused.
- Types: Add public auth-related types to `src/auth.ts` if local to auth functions, or `src/types.ts` if shared across action modules.
- Tests: Extend `tests/auth.test.ts`.

**New Helper Module:**
- Implementation: Add `src/helpers/<name>.ts`.
- Barrel export: Add `export * from "./<name>.js";` to `src/helpers/index.ts`.
- Usage: Import from the specific helper file for focused internal dependencies (`src/helpers/fetch.ts`) or from `src/helpers/index.ts` when existing modules already use the helper barrel.
- Tests: Add `tests/helpers/<name>.test.ts`.

**New Browser DOM Utility:**
- Implementation: Add to `src/media.ts` when it operates on `HTMLImageElement`, `HTMLVideoElement`, `HTMLAudioElement`, DOM trees, or source elements.
- Exports: `src/index.ts` already re-exports `src/media.ts`; add a `package.json` subpath only for a new standalone public module.
- Tests: Use browser-gated tests with Vitest browser mode; run `pnpm vitest run --browser --browser.headless` for DOM-facing changes.

**New HLS Integration:**
- Implementation: Add to `src/hls.ts` when it extends `hls.js` loader contracts or fallback behavior.
- Imports: Keep `hls.js` imports type-only unless changing optional peer dependency semantics.
- Tests: Add browser-compatible tests under `tests/` and use the browser runner when DOM/browser APIs are involved.

**New Shared Type:**
- Implementation: Add to `src/types.ts` when multiple modules or consumers need the type.
- Local-only types: Keep local option/helper types in the module that owns the function, such as `src/actions/upload.ts` or `src/helpers/fetch.ts`.
- Avoid runtime cycles: Use `import type` when a type in `src/types.ts` references action option types.

**New Package Subpath:**
- Source: Create or identify source entrypoint under `src/`.
- Build: Ensure TypeScript emits a matching `lib/<entry>.js` and `lib/<entry>.d.ts` path.
- Package exports: Add a matching subpath to `package.json` with `import` and `types` entries.
- Documentation: Update `README.md` and TypeDoc comments for public APIs.

## Special Directories

**`lib/`:**
- Purpose: Generated package output used by `package.json` `main`, `module`, `typings`, and `exports`.
- Generated: Yes, by `pnpm build` / `tsc` from `src/`.
- Committed: Yes; present in the repository and included in package files.

**`src/actions/`:**
- Purpose: Behavior layer for Blossom HTTP endpoints and multi-server orchestration.
- Generated: No.
- Committed: Yes.

**`src/helpers/`:**
- Purpose: Shared utility layer consumed by actions, auth, media, HLS, and users.
- Generated: No.
- Committed: Yes.

**`tests/`:**
- Purpose: Vitest node and browser test files plus test helper modules.
- Generated: No.
- Committed: Yes.

**`.github/workflows/`:**
- Purpose: GitHub Actions automation for tests, documentation, and releases.
- Generated: No.
- Committed: Yes.

**`.changeset/`:**
- Purpose: Changesets configuration and release metadata.
- Generated: Partially; config is maintained, release changeset files are generated by `pnpm changeset`.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: GSD mapping outputs consumed by planning and execution workflows.
- Generated: Yes, by GSD codebase mapping.
- Committed: Project-dependent; treat as planning artifacts and do not edit source behavior here.

---

*Structure analysis: 2026-07-25*
