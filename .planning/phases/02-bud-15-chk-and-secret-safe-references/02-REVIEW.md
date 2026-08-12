---
phase: 02-bud-15-chk-and-secret-safe-references
reviewed: 2026-08-12T15:52:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - .changeset/bud-15-chk.md
  - README.md
  - src/hashtree/blossom-reference.ts
  - src/hashtree/chk.ts
  - src/hashtree/index.ts
  - src/hashtree/types.ts
  - tests/hashtree/blossom-reference.test.ts
  - tests/hashtree/chk.test.ts
  - tests/hashtree/exports.test.ts
  - tests/hashtree/fixtures/clean-error.fixture.ts
  - tests/hashtree/fixtures/leaky-diagnostic.fixture.ts
  - tests/hashtree/fixtures/leaky-error.fixture.ts
  - tests/hashtree/fixtures/leaky-root.fixture.mjs
  - tests/hashtree/isolation.test.ts
  - tests/hashtree/package.test.ts
  - tests/hashtree/secret-safety.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-12T15:52:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The Phase 02 CHK implementation, strict Blossom-reference helpers, package-boundary tests, safety contracts, documentation, and release metadata were reviewed at standard depth. The build and focused Node test suite pass, but the decryption failure path retains an owned key copy when ciphertext-address verification fails, and builder validation can leak a native `TypeError` for an invalid hash type instead of honoring its typed validation-error contract.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Ciphertext-hash failure bypasses owned key cleanup

**Classification:** WARNING
**File:** `src/hashtree/chk.ts:72-77`
**Issue:** `decryptChk()` copies the caller's secret CHK key into `keyCopy`, then performs ciphertext-hash verification before entering the `try/finally` that wipes `keyCopy`. A hash mismatch throws at line 75, bypassing line 96 and leaving the owned secret buffer resident until garbage collection. This contradicts the function's cleanup strategy and the phase contract to wipe owned scratch key buffers in `finally`.
**Fix:** Move ciphertext-address verification and HKDF derivation inside an outer `try/finally` that always wipes `keyCopy`; initialize `aesKey` only after the hash check and wipe it conditionally.

```ts
const keyCopy = copyBytes(key);
let aesKey: Uint8Array<ArrayBuffer> | undefined;
try {
  if (!equalBytes(hashHashtreeContent(ciphertextCopy), hashCopy)) throw integrityError();
  aesKey = copyBytes(hkdf(sha256, keyCopy, CHK_SALT, CHK_INFO, KEY_LENGTH));
  // import, decrypt, and verify plaintext
} finally {
  aesKey?.fill(0);
  keyCopy.fill(0);
}
```

### WR-02: Invalid builder hash types escape as native TypeErrors

**Classification:** WARNING
**File:** `src/hashtree/blossom-reference.ts:40-41`
**Issue:** `validateBase()` passes `reference.sha256` directly to `isSha256()`, whose implementation calls `.match()`. JavaScript consumers can pass `{ sha256: null }`, a number, or another non-string value despite the TypeScript signature; the builder then throws a native `TypeError` rather than the documented `HashtreeValidationError`. Other base fields perform runtime type checks, so the validation contract is inconsistent and callers cannot reliably handle malformed builder input.
**Fix:** Check the runtime type before calling the helper and add negative tests for non-string hash values.

```ts
if (typeof reference.sha256 !== "string" || !isSha256(reference.sha256)) {
  invalid("sha256 must be 64 lowercase hexadecimal characters");
}
```

---

_Reviewed: 2026-08-12T15:52:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
