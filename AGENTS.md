# blossom-client-sdk

## Repo Shape

- Single-package TypeScript ESM library. Build output goes to `lib/` via `pnpm build` (`tsc`). There is no monorepo or app runtime.
- Public entrypoints are defined in `package.json` `exports`. Root import maps to `src/index.ts`; action functions also have dedicated `./actions` and `./actions/*` subpath exports.
- `src/index.ts` re-exports `const`, `auth`, `helpers`, `media`, `nostr`, `error`, and `types`, plus `Actions` as a namespace. Do not assume every action is flattened onto the root export.

## Architecture

- `src/auth.ts` is the auth core: it builds and matches Nostr kind `24242` events, normalizes server tags, and manages reusable auth events.
- `src/actions/*.ts` are the main behavior layer. Individual actions handle their own retry flow for `401` auth challenges and `402` Cashu payment challenges.
- `src/actions/multi-server.ts` is the non-obvious orchestration path: `multiServerUpload()` does parallel preflight `HEAD /<sha256>` checks by default, uploads once, then mirrors or skips per server; `multiServerMediaUpload()` uploads to one `/media` endpoint first, then mirrors the optimized blob.

## Commands

- `pnpm test`: node Vitest suite.
- `pnpm vitest run tests/auth.test.ts`: run one test file.
- `pnpm vitest run --browser --browser.headless`: browser suite for DOM/media helpers.
- `pnpm coverage`: coverage run.
- `pnpm build`: compile `src/` to `lib/` and emit declarations.
- `pnpm format`: Prettier over the whole repo.

## Verification

- GitHub CI runs the full suite on Node `20.19.0`, `20`, `22`, `24`, Deno 2, and Bun, plus Chromium, Firefox, and WebKit.
- `pnpm test:node`, `pnpm test:deno`, and `pnpm test:bun` run the same Vitest suite in the named runtime, followed by built-package tests. `tests/runtime-check.ts` verifies the worker runtime.
- ngit CI uses `.grasp/nix/workflows/ci.yaml` and the root Nix flake to run the same scripts on Linux. Keep CI-only Nix definitions under `.grasp/nix/`.
- If you touch DOM-facing media helpers in `src/media.ts`, run the browser suite, not just node tests.
- There is no lint script. Formatting is enforced by Prettier (`2` spaces, `printWidth: 120`).

## Tests

- HTTP-facing tests use the global fetch mock initialized in `tests/fetch.ts` via `vitest-fetch-mock`.
- Browser-only tests are gated inline with `describe.runIf(typeof document !== "undefined")`; they only execute under the browser runner.

## Release Workflow

- Default branch is `master`.
- The maintainer bumps versions and publishes releases locally. Do not bump versions or publish unless explicitly asked.
- Stage public, customer-facing changes under `## Unreleased` at the top of `CHANGELOG.md`; create the section if absent and follow the changelog's existing format.
- Keep entries concise and focused on package consumers: describe observable behavior, API changes, fixes, and compatibility requirements. Clearly identify breaking changes and any required migration.
- Use one entry per distinct change. Exclude internal-only refactors, tests, CI, tooling, and implementation details that do not affect consumers.
- When cutting a release, the maintainer moves the staged entries into the new version's section, bumps the package version, and publishes locally.
