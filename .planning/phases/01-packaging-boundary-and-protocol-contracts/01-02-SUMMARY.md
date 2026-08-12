---
phase: 01-packaging-boundary-and-protocol-contracts
plan: 02
subsystem: packaging
tags: [esm, npm-pack, isolation, changesets, vitest]
requires:
  - phase: 01-01
    provides: Portable Hashtree package entrypoint and typed errors
provides:
  - Three-dimensional proof that root imports remain Hashtree-free
  - Extracted npm tarball verification for exact and wildcard Hashtree entries
  - Minor Changeset for the public Hashtree contract
affects: [release, package-boundary, future-hashtree-dependencies]
tech-stack:
  added: []
  patterns: [fail-closed emitted ESM graph walker, loader evaluation sentinel, extracted package self-reference]
key-files:
  created:
    - tests/hashtree/isolation.test.ts
    - tests/hashtree/package.test.ts
    - .changeset/hashtree-contracts.md
  modified: []
key-decisions:
  - "Treat namespace, runtime evaluation, and transitive graph isolation as separate required proofs."
  - "Exercise package self-references from a real .mjs file inside the extracted package scope."
  - "Keep the Hashtree-exclusive dependency denylist explicit and empty until a later phase adds one."
patterns-established:
  - "Emitted graph walks resolve every relative edge and fail on missing targets."
  - "Packed-artifact tests use one unique temporary directory and unconditional finally cleanup."
requirements-completed: [PKG-02, TEST-04]
duration: 3m
completed: 2026-08-12
status: complete
---

# Phase 1 Plan 2: Package Isolation and Packed Artifact Summary

Independent namespace, evaluation, and emitted-graph isolation proofs plus real npm-tarball self-reference checks for every public Hashtree entry.

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-12T10:34:43Z
- **Completed:** 2026-08-12T10:37:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Proved the built root namespace exposes no Hashtree classes, a fresh root import evaluates no Hashtree module, and the root's emitted transitive graph reaches no Hashtree output.
- Added a fail-closed emitted ESM walker with explicit missing-entry and unresolved-edge coverage.
- Packed and extracted the actual npm artifact, verified all exact and wildcard JS/declaration targets, and exercised package self-references from the extracted package scope.
- Recorded the opt-in portable contract and stable typed errors as a minor Changesets release.
- Passed the full node suite with 286 tests passing.

## Task Commits

1. **Task 1: Prove root isolation in all three dimensions** — `a6b5673` (test)
2. **Task 2: Verify extracted packed package and record release intent** — `008d66c` (test)

## Files Created/Modified

- `tests/hashtree/isolation.test.ts` — Namespace, evaluation-sentinel, transitive-graph, and fail-closed isolation tests.
- `tests/hashtree/package.test.ts` — Real npm pack, extraction, target existence, self-reference, and cleanup verification.
- `.changeset/hashtree-contracts.md` — Minor release intent for the public Hashtree API.

## Decisions Made

- Root namespace assertions are not substitutes for runtime evaluation or transitive graph checks; all three remain independent gates.
- The loader delegates to Node before instrumenting only real files beneath `lib/hashtree/`, and a positive control proves the sentinel can detect evaluation.
- Temporary package extraction occurs beneath the project solely so the extracted root's existing dependencies resolve from the repository toolchain; no consumer installation, lockfile, or fixture is created.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm build` — passed.
- `pnpm test` — 26 files passed, 1 browser-only file skipped; 286 tests passed, 25 environment-gated tests skipped.
- `pnpm vitest run tests/hashtree/package.test.ts tests/hashtree/isolation.test.ts` — 5 passed.
- `pnpm exec changeset status` — reports `blossom-client-sdk` minor bump.
- `pnpm exec prettier --check tests/hashtree .changeset/hashtree-contracts.md` — passed.

## Known Stubs

None. The explicit empty exclusive-dependency denylist is intentional because Phase 1 adds no Hashtree-exclusive dependency; later phases must add entries when introducing one.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 1's package boundary, portable contracts, typed errors, root isolation, and packed-artifact requirements are complete.
- Later phases can add protocol implementations behind the isolated entrypoint; any new Hashtree-only dependency must be added to the graph-test denylist.

## Self-Check: PASSED

- All three created files exist.
- Task commits `a6b5673` and `008d66c` exist.
- All task acceptance criteria, full node tests, Changesets status, and formatting checks passed.
