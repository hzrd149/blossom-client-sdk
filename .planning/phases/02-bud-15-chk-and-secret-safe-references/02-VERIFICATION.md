---
phase: 02-bud-15-chk-and-secret-safe-references
verified: 2026-08-12T15:54:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
next_action: "Proceed to Phase 3 planning. Address the two advisory cleanup/validation warnings when practical."
next_command: "$gsd-plan-phase 3"
---

# Phase 2: BUD-15 CHK and Secret-Safe References Verification Report

**Phase Goal:** Consumers can protect Hashtree content with exact BUD-15 behavior without leaking capabilities or weakening integrity verification.
**Verified:** 2026-08-12T15:54:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | BUD-15 encryption is deterministic and decryption enforces ciphertext address, GCM authentication, then plaintext CHK. | ✓ VERIFIED | `src/hashtree/chk.ts` implements SHA-256, pinned HKDF inputs, zero-IV AES-256-GCM, pre-decrypt ciphertext hashing and post-decrypt plaintext hashing. The pinned hello vector and all three integrity stages pass in Node and Chromium. |
| 2 | Empty, equal, distinct, reordered, and concurrent chunks behave as independent pure transforms. | ✓ VERIFIED | `tests/hashtree/chk.test.ts` exercises the pinned empty vector, equality/deduplication, adjacency, reversed call order, and 24 concurrent encrypt/decrypt operations; all pass in both runtimes. |
| 3 | Caller byte arrays remain owned by the caller and returned arrays do not alias inputs. | ✓ VERIFIED | The implementation copies public inputs/outputs and the CHK ownership test verifies no input mutation and output independence. |
| 4 | Encrypted Blossom references require one `enc=chk-v1` and one lowercase 32-byte `k`, rejecting missing, duplicate, conflicting, or unsupported fields. | ✓ VERIFIED | Strict cardinality/mode/key checks in `src/hashtree/blossom-reference.ts`; nine adversarial reference cases pass. |
| 5 | Reference parse/build is lossless for repeated extensions and canonical/idempotent across repeated and concurrent calls. | ✓ VERIFIED | Parser preserves unknown entries; builder orders recognized fields then stable decoded extension key/value order. Canonicalization, empty values, repeated values, idempotency, and concurrency tests pass. |
| 6 | Plaintext and `chk-v1` are first-class modes, with omitted client mode resolving to plaintext. | ✓ VERIFIED | `HashtreeMode` and discriminated `HashtreeModeOptions` encode the contract; runtime/type tests prove omitted, explicit plaintext, and encrypted cases. |
| 7 | Ordinary integrity errors, progress, and diagnostics do not expose capabilities or plaintext. | ✓ VERIFIED | All integrity stages produce the same cause-free public error shape. Non-vacuous leaky/clean fixtures and compile-time negative checks enforce capability-free diagnostic/progress contracts. |
| 8 | Phase 2 APIs are available through the Hashtree entrypoint and focused wildcard paths without entering the root API. | ✓ VERIFIED | `src/hashtree/index.ts` re-exports the implementation; export, declaration, package self-reference, and Chromium entrypoint checks pass. |
| 9 | Root imports neither export/evaluate Hashtree modules nor reach the CHK-only HKDF edge. | ✓ VERIFIED | `tests/hashtree/isolation.test.ts` walks the emitted graph and instruments module evaluation; all five isolation checks pass, including non-vacuous leaky fixtures. |
| 10 | Packed artifacts, public safety documentation, and release intent exist for Phase 2. | ✓ VERIFIED | The extracted tarball resolves exact and wildcard targets; README documents deterministic confirmation/equality leakage and bearer-capability handling; `.changeset/bud-15-chk.md` records the minor release. |

**Score:** 10/10 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/hashtree/chk.ts` | Exact CHK primitives | ✓ VERIFIED | Substantive, exported, wired through the Hashtree index, and exercised by Node/browser vectors and adversarial tests. |
| `src/hashtree/blossom-reference.ts` | Strict capability reference parser/builder | ✓ VERIFIED | Substantive, exported, wired, and covered by 13 focused tests. |
| `src/hashtree/types.ts` | Plaintext-default, secret-safe contracts | ✓ VERIFIED | Exported through the entrypoint and checked by compile-time-negative declarations. |
| `tests/hashtree/chk.test.ts` | Vectors and integrity/chunk behavior | ✓ VERIFIED | Eight tests pass in Node and Chromium. |
| `tests/hashtree/blossom-reference.test.ts` | Strict parsing/canonicalization | ✓ VERIFIED | Thirteen tests pass in Node and Chromium. |
| `tests/hashtree/secret-safety.test.ts` | Leak and ownership regression checks | ✓ VERIFIED | Five Node tests pass; four applicable browser tests pass. |
| `tests/hashtree/exports.test.ts` | Runtime/declaration/browser boundary | ✓ VERIFIED | Applicable Node and browser checks pass. |
| `tests/hashtree/package.test.ts` | Extracted package smoke proof | ✓ VERIFIED | Tarball extraction and self-reference smoke test pass. |
| `.changeset/bud-15-chk.md` | Release intent | ✓ VERIFIED | Present and substantive. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/hashtree/chk.ts` | `src/hashtree/errors.ts` | Generic validation/integrity errors | ✓ WIRED | Imports and throws stable Hashtree error classes. |
| `src/hashtree/blossom-reference.ts` | `src/hashtree/errors.ts` | Strict malformed-reference rejection | ✓ WIRED | All explicit validation paths use `HashtreeValidationError` (one malformed JS builder type caveat below). |
| `src/hashtree/index.ts` | CHK/reference/type modules | Curated `.js` re-exports | ✓ WIRED | Runtime exports and declarations are proven by source and packed-package tests. |
| `package.json` | `lib/hashtree/*` | Exact and wildcard exports | ✓ WIRED | Extracted-package imports execute successfully. |

### Data-Flow Trace (Level 4)

Not applicable: this phase is a stateless library with no dynamic UI/store/data-source artifacts. Byte input flows directly through copied cryptographic transforms to returned byte arrays; reference input flows through validation to fresh parsed objects or canonical strings.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build and focused Phase 2 Node behavior | `pnpm build && pnpm vitest run tests/hashtree/{chk,blossom-reference,secret-safety,exports,package,isolation}.test.ts` | Build passed; 6 files passed, 35 tests passed, 1 browser-only test skipped | ✓ PASS |
| Browser cryptography/reference/public surface | `pnpm vitest run --browser --browser.headless tests/hashtree/chk.test.ts tests/hashtree/blossom-reference.test.ts tests/hashtree/secret-safety.test.ts tests/hashtree/exports.test.ts` | 4 files passed, 28 tests passed, 2 Node-only tests skipped | ✓ PASS |

### Probe Execution

No Phase 2 probe scripts are declared or present; the phase uses focused Node/browser suites and package smoke tests instead.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CHK-01 | 02-01, 02-03 | Exact deterministic `chk-v1` encryption | ✓ SATISFIED | Pinned hello/empty vectors pass in Node and Chromium. |
| CHK-02 | 02-01, 02-03 | Ordered ciphertext/GCM/plaintext integrity verification | ✓ SATISFIED | Code ordering inspected; adversarial tests exercise each stage and indistinguishable errors. |
| CHK-03 | 02-01, 02-03 | Per-chunk plaintext-derived keys | ✓ SATISFIED | Distinct/equal/adjacent/order/concurrency tests pass. |
| CHK-04 | 02-02, 02-03 | Parse/create valid encrypted Blossom references | ✓ SATISFIED | Strict parser/builder and canonical round-trip tests pass. |
| CHK-05 | 02-01, 02-02, 02-03 | Secrets absent from requests/errors/progress/diagnostics | ✓ SATISFIED | No storage/request API exists in this phase; public errors and metadata are leak-tested, capability objects are explicit, and root isolation is enforced. |
| CHK-06 | 02-02, 02-03 | First-class plaintext/encrypted modes, plaintext default | ✓ SATISFIED | Discriminated public types and omitted-mode behavior are tested and exported. |

No Phase 2 requirements are orphaned: all six ROADMAP/REQUIREMENTS IDs appear in PLAN frontmatter and have implementation evidence.

### Anti-Patterns and Advisory Findings

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/hashtree/chk.ts` | 72-77 | Early ciphertext-hash rejection occurs before the `finally` that wipes `keyCopy` | ⚠️ Warning | No public capability leak was found, but the owned key copy remains until garbage collection on this path, weakening defense-in-depth cleanup. |
| `src/hashtree/blossom-reference.ts` | 40 | Non-string `sha256` supplied by untyped JS can cause native `TypeError` in `isSha256` | ⚠️ Warning | Malformed input is still rejected, so CHK-04 holds, but the builder does not consistently return the documented typed validation error. This path lacks a regression test. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers or implementation stubs were found in Phase 2 source/test files.

### Human Verification Required

None. The security-sensitive runtime behaviors, package boundary, and browser compatibility have direct automated evidence.

### Gaps Summary

No blocking goal gaps. The two advisory findings above should be repaired as hardening work: always wipe the copied key on early address failure, and runtime-check `sha256` before calling `isSha256`. They do not invalidate the observable phase goal because no public secret exposure or integrity bypass is present, malformed references remain rejected, and all roadmap behaviors are exercised.

---

_Verified: 2026-08-12T15:54:00Z_
_Verifier: the agent (gsd-verifier)_
