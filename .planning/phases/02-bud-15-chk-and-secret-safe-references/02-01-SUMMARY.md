---
phase: 02-bud-15-chk-and-secret-safe-references
plan: 01
subsystem: cryptography
tags: [bud-15, sha256, hkdf, aes-gcm, webcrypto, vitest]
requires:
  - phase: 01-packaging-boundary-and-protocol-contracts
    provides: Isolated Hashtree subpath and typed validation/integrity errors
provides:
  - Deterministic BUD-15 chk-v1 encryption and verified decryption
  - Official empty and hello vector coverage in Node and Chromium
  - Uniform cause-free integrity failures and caller-owned byte guarantees
affects: [02-02, bud-16, bud-17, bud-18, hashtree-storage]
tech-stack:
  added: []
  patterns: [plaintext-derived content keys, full-loop hash comparison, owned scratch wiping]
key-files:
  created:
    - src/hashtree/chk.ts
    - tests/hashtree/chk.test.ts
    - tests/hashtree/secret-safety.test.ts
    - tests/hashtree/fixtures/leaky-error.fixture.ts
    - tests/hashtree/fixtures/clean-error.fixture.ts
  modified: []
key-decisions:
  - Keep CHK hashing synchronous while encryption and verified decryption use portable Web Crypto promises.
  - Construct a fresh integrity error and remove the inherited undefined cause property at the CHK boundary.
patterns-established:
  - Copy every caller byte array at the public crypto boundary and wipe only owned derived-key scratch.
  - Validate ciphertext address before GCM and plaintext commitment after GCM with one public error shape.
requirements-completed: [CHK-01, CHK-02, CHK-03, CHK-05]
duration: 4m
completed: 2026-08-12
status: complete
---

# Phase 02 Plan 01: BUD-15 CHK Core Summary

**Exact BUD-15 SHA-256/HKDF-SHA256/AES-256-GCM vectors with fail-closed verification, cause-free errors, and caller-owned byte isolation**

## Performance

- **Duration:** 4m
- **Started:** 2026-08-12T15:31:07Z
- **Completed:** 2026-08-12T15:35:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Matched the pinned BUD-15 empty and `hello` ciphertext, content-key, and blob-hash vectors byte-for-byte.
- Enforced ciphertext-address verification before AES-GCM and plaintext CHK verification afterward.
- Proved deterministic identical-chunk deduplication, distinct per-chunk keys, call-order stability, and parallel-call isolation.
- Added non-vacuous recursive secret-leak checks and caller input/output non-aliasing regression coverage.

## Task Commits

Each task followed RED/GREEN TDD commits:

1. **Task 1: Prove one exact CHK encrypt-to-verified-decrypt path**
   - `8596994` — failing tracer vectors
   - `eb8ab93` — deterministic CHK implementation
2. **Task 2: Close every integrity stage and per-chunk ownership edge**
   - `768362a` — failing adversarial and secret-safety tests
   - `712062e` — integrity and ownership hardening

## Files Created/Modified

- `src/hashtree/chk.ts` — portable BUD-15 hashing, encryption, and verified decryption primitives.
- `tests/hashtree/chk.test.ts` — official vectors, integrity ordering, validation, chunk, concurrency, and ownership coverage.
- `tests/hashtree/secret-safety.test.ts` — recursive public-error secret retention checks.
- `tests/hashtree/fixtures/leaky-error.fixture.ts` — known-leaky negative-control fixture.
- `tests/hashtree/fixtures/clean-error.fixture.ts` — clean control fixture.

## Decisions Made

- Used installed `@noble/hashes` v1.8 SHA-256/HKDF APIs and Web Crypto AES-GCM without adding dependencies.
- Kept the output contract limited to independent `{ ciphertext, key }` byte arrays.
- Used a fixed-length full-loop XOR accumulator for portable hash comparisons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest `-x` option**
- **Found during:** Task 1 RED verification
- **Issue:** Vitest 3.1.3 rejects the plan's pytest-style `-x` flag.
- **Fix:** Used the supported `--bail=1` equivalent for focused fail-fast runs.
- **Files modified:** None
- **Verification:** Both focused suites passed with `--bail=1`.
- **Commit:** N/A (command-only deviation)

**2. [Rule 2 - Security] Removed inherited undefined cause from integrity errors**
- **Found during:** Task 2 GREEN
- **Issue:** The shared error base creates an own `cause` property even when no cause is supplied, violating the cause-free CHK error contract.
- **Fix:** CHK's integrity-error factory deletes that property before exposing the fresh error.
- **Files modified:** `src/hashtree/chk.ts`
- **Verification:** All four integrity paths have identical own-property shapes and no `cause`.
- **Commit:** `712062e`

**Total deviations:** 2 auto-fixed (1 blocking command correction, 1 security hardening).
**Impact:** No scope expansion; verification and the locked public error contract are stronger.

## Known Stubs

None.

## Verification

- `pnpm build` — passed.
- `pnpm vitest run tests/hashtree/chk.test.ts tests/hashtree/secret-safety.test.ts` — 10 tests passed.
- `pnpm vitest run --browser --browser.headless tests/hashtree/chk.test.ts tests/hashtree/secret-safety.test.ts` — 10 Chromium tests passed.
- BUD-15 PR #104 head rechecked as `ef6c7fb4435530556fb32345eec010505bda017a`.

## Self-Check: PASSED

- All five declared key files exist.
- All four TDD task commits exist in git history.
- Node, Chromium, and TypeScript declaration gates pass.

## Next Phase Readiness

- CHK primitives are ready for encrypted Blossom reference parsing and export integration in Plan 02-02.
- No blockers remain.
