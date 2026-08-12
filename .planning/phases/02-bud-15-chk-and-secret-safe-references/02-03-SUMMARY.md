---
phase: 02-bud-15-chk-and-secret-safe-references
plan: 03
subsystem: packaging
tags: [bud-15, chk, package-exports, browser-portability, capability-safety]
requires:
  - phase: 02-bud-15-chk-and-secret-safe-references
    provides: Exact CHK primitives, strict Blossom references, and secret-safe public contracts
provides:
  - Curated Hashtree exports for every Phase 2 runtime and type
  - Root namespace, evaluation, graph, and CHK-exclusive dependency isolation proofs
  - Extracted-package wildcard smoke coverage and consumer security guidance
  - Minor release intent for the complete BUD-15 surface
affects: [bud-16, bud-17, bud-18, package-boundary, hashtree-client]
tech-stack:
  added: []
  patterns: [opt-in wildcard modules, positive-control isolation fixtures, capability-risk documentation]
key-files:
  created:
    - tests/hashtree/fixtures/leaky-root.fixture.mjs
    - .changeset/bud-15-chk.md
  modified:
    - src/hashtree/index.ts
    - tests/hashtree/exports.test.ts
    - tests/hashtree/isolation.test.ts
    - tests/hashtree/package.test.ts
    - README.md
key-decisions:
  - Keep CHK and reference functions exclusively on Hashtree entrypoints and focused wildcard modules.
  - Deny only the CHK-exclusive @noble/hashes/hkdf edge because sha2 is already part of the root helper graph.
  - Document parsed encrypted references and complete encrypted URIs as bearer capabilities.
requirements-completed: [CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06]
coverage:
  - id: D1
    description: Consumers can import every Phase 2 runtime and type through exact and wildcard Hashtree paths.
    requirement: CHK-01
    verification:
      - kind: integration
        ref: tests/hashtree/exports.test.ts
        status: pass
      - kind: e2e
        ref: tests/hashtree/package.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Root imports remain isolated from CHK/reference modules and their exclusive HKDF edge.
    requirement: CHK-05
    verification:
      - kind: integration
        ref: tests/hashtree/isolation.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Published guidance explains deterministic confirmation and bearer-capability risks.
    requirement: CHK-05
    verification:
      - kind: other
        ref: README.md#hashtree-bud-15-support
        status: pass
    human_judgment: false
duration: 7m
completed: 2026-08-12
status: complete
---

# Phase 02 Plan 03: Portable BUD-15 Package Surface Summary

**Portable CHK and strict capability references published behind isolated Hashtree entrypoints with packed-artifact, browser, and root-graph proofs**

## Performance

- **Duration:** 7m
- **Started:** 2026-08-12T15:41:53Z
- **Completed:** 2026-08-12T15:48:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Exported all Phase 2 CHK, reference, mode, progress, and diagnostic contracts through the opt-in Hashtree barrel without changing the package root.
- Proved exact and wildcard declaration portability, Chromium loading, root namespace/evaluation/graph isolation, and a non-vacuous CHK-exclusive dependency prohibition.
- Verified real packed output contains and self-imports both new wildcard modules from an extracted package scope.
- Documented low-entropy confirmation risk, bearer-capability handling, generic integrity failures, and plaintext-default future clients, with a scoped minor Changeset.

## Task Commits

1. **Task 1: Expose the curated portable API while proving root isolation**
   - `505923d` — failing Phase 2 export and isolation contracts
   - `2fcd304` — portable CHK/reference exports and root HKDF isolation
2. **Task 2: Verify the packed contract, document capability risk, and record release intent**
   - `42bc4e2` — packed wildcard proof, safety guidance, and release metadata

## Files Created/Modified

- `src/hashtree/index.ts` — curated `.js` re-exports for CHK and Blossom reference modules.
- `tests/hashtree/exports.test.ts` — exact runtime/type allowlists, portable declaration consumer, and Chromium contract.
- `tests/hashtree/isolation.test.ts` — root symbol/evaluation/graph checks plus the CHK-exclusive HKDF denylist.
- `tests/hashtree/fixtures/leaky-root.fixture.mjs` — known-bad positive control for dependency leakage.
- `tests/hashtree/package.test.ts` — packed targets and real-package wildcard self-import smoke test.
- `README.md` — BUD-15 security and capability guidance.
- `.changeset/bud-15-chk.md` — complete Phase 2 minor release intent.

## Decisions Made

- Kept all new functionality behind `blossom-client-sdk/hashtree` and its wildcard paths; the root entrypoint remains unchanged.
- Classified `@noble/hashes/hkdf` as the exclusive CHK dependency edge. `@noble/hashes/sha2` cannot be denied because existing root helpers already reach it.
- Used a deliberately leaky fixture to prove the exclusive-dependency assertion detects a real violation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest `-x` option**
- **Found during:** Task verification
- **Issue:** Vitest 3.1.3 rejects the plan's pytest-style `-x` flag.
- **Fix:** Used the supported `--bail=1` fail-fast equivalent.
- **Files modified:** None
- **Verification:** All focused task suites passed.
- **Commit:** N/A (command-only deviation)

**2. [Rule 1 - Bug] Updated packed error-module equality after expanding the barrel**
- **Found during:** Task 2 packed smoke verification
- **Issue:** The Phase 1 smoke test assumed the errors wildcard and Hashtree barrel had identical runtime exports, which became false when CHK/reference functions were added.
- **Fix:** Compare the errors wildcard against the barrel's error-class subset while asserting new wildcard functions separately.
- **Files modified:** `tests/hashtree/package.test.ts`
- **Verification:** Extracted-package self-reference smoke test passed.
- **Commit:** `42bc4e2`

**Total deviations:** 2 auto-fixed (1 blocking command correction, 1 test-contract bug).
**Impact:** No scope expansion; the intended fail-fast behavior and packed public contract are preserved.

## Known Stubs

None.

## Verification

- `pnpm build` — passed.
- `pnpm test` — 29 files passed, 1 browser-only file skipped; 313 tests passed, 25 skipped.
- Focused Node package/export/isolation gate — 9 tests passed, 1 browser-only test skipped.
- Focused Chromium Hashtree gate — 5 files passed; 37 tests passed, 2 Node-only checks skipped.
- `pnpm exec changeset status` — reports `blossom-client-sdk` minor bump.
- Scoped Prettier check — passed.
- `pnpm docs` — passed.
- The repository-wide Chromium invocation stalled in unrelated pre-existing suites and was stopped; the complete browser-compatible Hashtree surface passed independently. Node-only package and isolation files correctly cannot load in Chromium.
- `.planning/config.json` remained byte-for-byte unchanged from its pre-execution diff.

## Issues Encountered

- The full browser runner stopped making progress after seven unrelated suites. Focused browser-compatible Hashtree suites completed successfully; package and graph tests remain intentionally Node-only.

## Self-Check: PASSED

- All seven declared key files exist.
- Task commits `505923d`, `2fcd304`, and `42bc4e2` exist in git history.
- All task acceptance criteria and plan-level build, Node, focused Chromium, Changesets, formatting, and documentation gates pass.

## Next Phase Readiness

- Phase 2's complete BUD-15 crypto, reference, safety, export, documentation, and release contracts are ready for Phase 3 BUD-16 canonical directories.
- No implementation blockers remain.
