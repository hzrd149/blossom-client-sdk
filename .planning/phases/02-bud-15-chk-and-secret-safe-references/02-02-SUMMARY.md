---
phase: 02-bud-15-chk-and-secret-safe-references
plan: 02
subsystem: references
tags: [bud-15, blossom-uri, capability-safety, typescript, vitest]
requires:
  - phase: 02-bud-15-chk-and-secret-safe-references
    provides: Verified chk-v1 encryption, decryption, and secret-safe integrity errors
provides:
  - Strict lossless parsing and canonical building of plaintext and chk-v1 Blossom references
  - Capability-bearing encrypted reference types with independent key bytes
  - Plaintext-default mode options and capability-free progress and diagnostic contracts
affects: [02-03, bud-16, bud-17, bud-18, hashtree-client]
tech-stack:
  added: []
  patterns: [ordered URLSearchParams pairs, discriminated capability types, narrow observability contracts]
key-files:
  created:
    - src/hashtree/blossom-reference.ts
    - tests/hashtree/blossom-reference.test.ts
    - tests/hashtree/fixtures/leaky-diagnostic.fixture.ts
  modified:
    - src/hashtree/types.ts
    - tests/hashtree/secret-safety.test.ts
key-decisions:
  - Represent unknown reference extensions as ordered key/value pairs so repeats and empty values survive round trips.
  - Emit recognized query fields in enc, k, xs, as, sz order before stable decoded key/value extension ordering.
  - Model plaintext as the only mode that may be omitted while requiring chk-v1 explicitly.
requirements-completed: [CHK-04, CHK-05, CHK-06]
duration: 4m
completed: 2026-08-12
status: complete
---

# Phase 02 Plan 02: Capability References and Secret-Safe Contracts Summary

**Strict singleton chk-v1 Blossom capabilities with lossless canonical extensions and plaintext-default capability-free observability contracts**

## Performance

- **Duration:** 4m
- **Started:** 2026-08-12T15:36:25Z
- **Completed:** 2026-08-12T15:40:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added strict plaintext and encrypted Blossom reference parsing with exact singleton `enc=chk-v1` and lowercase 32-byte `k` validation.
- Preserved repeated and empty unknown query pairs while producing deterministic recognized and extension field ordering.
- Proved parse/build idempotency, concurrent purity, stable hint ordering, symmetric builder validation, and independent bearer key ownership.
- Added portable mode, progress, and diagnostic types that encode plaintext as the future client default without admitting secret-bearing fields.
- Added runtime secret sentinels and a deliberately leaky diagnostic fixture so disclosure checks are non-vacuous.

## Task Commits

Each task followed RED/GREEN TDD commits:

1. **Task 1: Parse and canonically rebuild capability-bearing Blossom references**
   - `1416456` — failing strict reference and canonicalization tests
   - `0856b39` — strict lossless reference parser and builder
2. **Task 2: Publish plaintext-default and secret-safe callback contracts**
   - `dbbd084` — failing mode and secret-safe contract tests
   - `8e8f485` — portable mode, progress, and diagnostic contracts

## Files Created/Modified

- `src/hashtree/blossom-reference.ts` — strict capability-aware parser, builder, and reference contracts.
- `src/hashtree/types.ts` — plaintext-default mode and capability-free observability contracts.
- `tests/hashtree/blossom-reference.test.ts` — security cardinality, lossless extension, canonicalization, idempotency, and concurrency proofs.
- `tests/hashtree/secret-safety.test.ts` — runtime sentinels and forbidden-field compiler assertions.
- `tests/hashtree/fixtures/leaky-diagnostic.fixture.ts` — known-leaky negative-control diagnostic.

## Decisions Made

- Used ordered extension pairs rather than records so duplicate keys and empty values remain lossless.
- Kept parsed encrypted keys enumerable as documented bearer capabilities while excluding capability fields from routine public metadata types.
- Defined mode selection as a union where only the plaintext branch permits an omitted discriminator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest `-x` option**
- **Found during:** Task verification
- **Issue:** Vitest 3.1.3 does not support the plan's pytest-style `-x` flag.
- **Fix:** Used the supported `--bail=1` equivalent for focused fail-fast runs.
- **Files modified:** None
- **Verification:** Both focused suites passed with `--bail=1`.
- **Commit:** N/A (command-only deviation)

**Total deviations:** 1 auto-fixed blocking command correction.
**Impact:** No implementation scope change; the intended fail-fast verification behavior was preserved.

## Known Stubs

None.

## Verification

- `pnpm vitest run tests/hashtree/blossom-reference.test.ts tests/hashtree/secret-safety.test.ts` — 18 tests passed.
- `pnpm build` — passed with portable declarations emitted.
- `pnpm vitest run --browser --browser.headless tests/hashtree/blossom-reference.test.ts tests/hashtree/secret-safety.test.ts` — 17 Chromium tests passed and the Node-only declaration source check was skipped as intended.

## Self-Check: PASSED

- All five declared key files exist.
- All four TDD task commits exist in git history.
- Node, Chromium, and TypeScript build gates pass.

## Next Phase Readiness

- Reference and mode contracts are ready for curated Hashtree exports, package isolation checks, documentation, and release intent in Plan 02-03.
- No blockers remain.
