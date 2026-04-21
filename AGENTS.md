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
- `pnpm docs`: TypeDoc build; CI publishes the generated `docs/` directory on version tags.
- `pnpm format`: Prettier over the whole repo.

## Verification

- CI runs node tests on Node `18`, `20`, and `22`, plus a separate browser job on Node `22` after `pnpm exec playwright install`.
- If you touch DOM-facing media helpers in `src/media.ts`, run the browser suite, not just node tests.
- There is no lint script. Formatting is enforced by Prettier (`2` spaces, `printWidth: 120`).

## Tests

- HTTP-facing tests use the global fetch mock initialized in `tests/fetch.ts` via `vitest-fetch-mock`.
- Browser-only tests are gated inline with `describe.runIf(typeof document !== "undefined")`; they only execute under the browser runner.

## Release Workflow

- Default branch is `master`.
- Releases are driven by Changesets in CI (`.github/workflows/version-or-publish.yml`). If you change published behavior, add a changeset with `pnpm changeset` unless the user asks not to.
