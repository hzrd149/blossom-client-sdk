---
phase: 01-packaging-boundary-and-protocol-contracts
plan: 01
subsystem: packaging
tags: [typescript, esm, exports, browser, errors]
requires: []
provides:
  - Isolated blossom-client-sdk/hashtree package entrypoint
  - Portable Hashtree byte, stream, cancellation, and callback contracts
  - Stable typed Hashtree error hierarchy
affects: [01-02, bud-15, bud-16, bud-17, bud-18]
tech-stack:
  added: []
  patterns: [opt-in package subpath, browser-portable declarations, class-identity errors]
key-files:
  created:
    - src/hashtree/index.ts
    - src/hashtree/types.ts
    - src/hashtree/errors.ts
    - tests/hashtree/exports.test.ts
    - tests/hashtree/errors.test.ts
    - .changeset/curly-items-grow.md
  modified:
    - package.json
key-decisions:
  - "Confirmed confirm-wildcard: types and errors are permanent public imports beneath ./hashtree/*."
  - "Keep the package root byte-for-byte isolated from Hashtree exports."
  - "Use class identity/name and narrowly copied safe fields instead of error codes or generic context."
patterns-established:
  - "Hashtree modules use focused files and a flat barrel with .js ESM specifiers."
  - "Portable consumer tests compile built declarations with types: [] and DOM/ES libraries."
requirements-completed: [PKG-01, PKG-03, PKG-04]
duration: 5m
completed: 2026-08-12
status: complete
---

# Phase 1 Plan 1: Portable Hashtree Contract Summary

An isolated `blossom-client-sdk/hashtree` entrypoint with browser-portable foundational types and eight class-discriminated, privacy-safe error types.

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-12T10:28:32Z
- **Completed:** 2026-08-12T10:33:14Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Published exact `./hashtree` and permanent wildcard `./hashtree/*` mappings while leaving the root barrel unchanged.
- Added `Uint8Array`/Web-platform contracts that compile for a consumer with Node ambient types disabled.
- Added and comprehensively tested seven stable failure families beneath `HashtreeError`, preserving only declared safe context and ordinary causes.
- Verified the freshly built entrypoint in both Node Vitest and a real headless Chromium runner.

## Task Commits

1. **Task 1: Confirm permanent wildcard boundary** — User approved `confirm-wildcard` before implementation (decision-only checkpoint; no file commit).
2. **Task 2 RED: Add failing Hashtree export contract** — `42a6728` (test)
3. **Task 2 GREEN: Publish portable Hashtree entrypoint** — `5deffeb` (feat)
4. **Task 3: Lock complete typed-failure contract** — `10d9b9d` (test)

## Files Created/Modified

- `src/hashtree/types.ts` — Portable byte stream, operation options, and callback contracts.
- `src/hashtree/errors.ts` — Base error and seven stable typed failure families.
- `src/hashtree/index.ts` — Curated flat Hashtree barrel.
- `package.json` — Exact and wildcard Hashtree exports.
- `tests/hashtree/exports.test.ts` — Runtime, declaration, self-reference, isolation, and browser contract tests.
- `tests/hashtree/errors.test.ts` — Error identity, safe context, bounds, and privacy tests.
- `.changeset/curly-items-grow.md` — Minor release note for the new public entrypoint.

## Decisions Made

- The user explicitly approved `confirm-wildcard`; direct `types` and `errors` modules are permanent semver-supported imports.
- The root entrypoint remains unchanged and does not expose or evaluate Hashtree code.
- Error messages remain useful but non-exact; stable discrimination is by local-realm class identity and class name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added required Changeset**
- **Found during:** Task 2
- **Issue:** Publishing a new public package entrypoint changes released behavior, and repository instructions require a Changeset.
- **Fix:** Added a minor Changeset describing the opt-in Hashtree contract.
- **Files modified:** `.changeset/curly-items-grow.md`
- **Verification:** Prettier check passed.
- **Commit:** `5deffeb`

**2. [Rule 3 - Blocking Environment] Restored test dependencies and compatible Chromium assets**
- **Found during:** Task 2 verification
- **Issue:** The checkout had no installed dependencies, and Playwright 1.52 did not recognize Ubuntu 26.04 for browser downloads.
- **Fix:** Restored the frozen lockfile dependencies and installed Playwright's Ubuntu 24.04 fallback browser via `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE`.
- **Files modified:** None (environment-only)
- **Verification:** Browser suite passed in headless Chromium.
- **Commit:** N/A

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 blocking environment).
**Impact:** Required release metadata was added and verification became runnable; no product scope expanded.

## Verification

- `pnpm build` — passed.
- `pnpm vitest run tests/hashtree/errors.test.ts tests/hashtree/exports.test.ts` — 12 passed, 1 browser-only skip.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 pnpm vitest run --browser --browser.headless tests/hashtree/exports.test.ts` — 3 passed, 1 Node-only skip.
- `pnpm exec prettier --check src/hashtree tests/hashtree package.json` — passed.

## Known Stubs

None.

## Issues Encountered

- Playwright 1.52 does not directly classify Ubuntu 26.04; its supported Ubuntu 24.04 fallback browser was used successfully.

## Next Phase Readiness

- The opt-in entrypoint and contract foundation are ready for Plan 01-02 packed-package and transitive-isolation verification.
- No blockers remain.

## Self-Check: PASSED

- All created files exist.
- Task commits `42a6728`, `5deffeb`, and `10d9b9d` exist.
- All task acceptance criteria and plan verification commands passed.
