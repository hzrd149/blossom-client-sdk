---
phase: 01-packaging-boundary-and-protocol-contracts
verified: 2026-08-12T10:39:31Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Review the emitted Hashtree declarations and browser consumer/browser-runner evidence for absence of an implicit Node polyfill or @types/node requirement."
    expected: "The opt-in contract requires only ES/Web platform types in supported browser consumers."
    why_human: "unverified-prohibition — the PLAN leaves this negative portability judgment unresolved; automated evidence is supportive but is not authoritative disposition."
  - test: "Review the public Hashtree error fields and serialization behavior for retention of raw bytes, credentials, callback inputs, arbitrary context, or serialized causes."
    expected: "Only message, cause, operation, path, limit, and actual are retained as applicable, with no secret-bearing generic context surface."
    why_human: "unverified-prohibition — the PLAN leaves this privacy judgment unresolved; the focused test is supportive but cannot silently resolve the declared judgment item."
  - test: "Review the root namespace, fresh-process evaluation sentinel, and emitted static graph results for unintended Hashtree cost on root consumers."
    expected: "A root import exposes and evaluates no Hashtree module and reaches no Hashtree-only dependency."
    why_human: "unverified-prohibition — the PLAN leaves this transparency judgment unresolved; automated evidence is supportive but is not authoritative disposition."
---

# Phase 1: Packaging Boundary and Protocol Contracts Verification Report

**Phase Goal:** Consumers can opt into stable, portable Hashtree contracts while existing root-import consumers remain completely isolated from Hashtree code and dependencies.
**Verified:** 2026-08-12T10:39:31Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The built and packed `blossom-client-sdk/hashtree` subpath imports in Node.js 18+ and a browser without Node-only public types. | ✓ VERIFIED | `package.json` maps exact and wildcard entrypoints to emitted JS/declarations; build passed; Node declaration consumer with `types: []` passed; Chromium loaded the built entry; packed self-reference smoke passed. |
| 2 | Importing the package root exposes, evaluates, and reaches no Hashtree code or exclusive dependency. | ✓ VERIFIED | `src/index.ts` has no Hashtree edge. Isolation tests inspect namespace, instrument fresh-process module evaluation, and recursively walk the emitted static graph; all four isolation tests passed. |
| 3 | Consumers receive seven stable typed failure families with safe readonly context and preserved causes. | ✓ VERIFIED | `src/hashtree/errors.ts` implements validation, integrity, bounds, conflict, immutable-tree, callback, and lifecycle subclasses. Nine focused tests passed for identity, names, cause/context, bounds fields, and rejected arbitrary context. |
| 4 | A real built, packed, and extracted artifact resolves the exact and wildcard subpaths while its root remains isolated. | ✓ VERIFIED | `tests/hashtree/package.test.ts` invokes `npm pack`, extracts the tarball, checks all six JS/declaration targets, and runs package self-reference imports; the test passed. |
| 5 | The published opt-in contract carries the required minor Changeset. | ✓ VERIFIED | `.changeset/hashtree-contracts.md` declares a minor bump; `pnpm exec changeset status` reports `blossom-client-sdk` at minor. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/hashtree/index.ts` | Curated opt-in barrel | ✓ VERIFIED | Substantive for a barrel and directly re-exports only `types.js` and `errors.js`; emitted and consumed by exact package entry. |
| `src/hashtree/types.ts` | Portable foundational contracts | ✓ VERIFIED | Defines `MaybePromise`, `ByteStream`, operation options, and callback contract using only ES/Web types; declarations pass a Node-types-free compile. |
| `src/hashtree/errors.ts` | Stable typed error hierarchy | ✓ VERIFIED | Eight concrete runtime classes, narrow readonly fields, standard cause support, and focused passing tests. |
| `package.json` | Exact and wildcard Hashtree exports | ✓ VERIFIED | Both mappings target real build artifacts and are exercised from the extracted tarball. |
| `tests/hashtree/isolation.test.ts` | Root isolation proof | ✓ VERIFIED | Substantive namespace, evaluation, graph, and fail-closed checks; 4/4 passed. |
| `tests/hashtree/package.test.ts` | Packed consumer proof | ✓ VERIFIED | Performs real pack/extract/target/self-reference verification and cleans its temporary directory in `finally`; passed. |
| `.changeset/hashtree-contracts.md` | Minor release intent | ✓ VERIFIED | Valid Changesets metadata confirmed by CLI. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `package.json` | `lib/hashtree/index.js` and `.d.ts` | Exact `./hashtree` export | ✓ WIRED | Targets exist after `pnpm build` and resolve from the extracted package. |
| `src/hashtree/index.ts` | `types.ts`, `errors.ts` | Direct `.js` ESM re-exports | ✓ WIRED | Lines 1-2 re-export both modules; source, build, browser, and package tests consume the barrel. |
| `tests/hashtree/isolation.test.ts` | `lib/index.js` | Resolved `libRoot/index.js`, recursive graph walk, and fresh-process loader | ✓ WIRED | The generic verifier missed the computed path, but manual inspection and the passing tests prove the connection. |
| `tests/hashtree/package.test.ts` | Package export map | `npm pack`, extraction, package self-reference | ✓ WIRED | Exact, wildcard index, types, errors, and root imports execute inside the extracted package scope. |

### Data-Flow Trace (Level 4)

Not applicable: this phase publishes static library contracts and package metadata; no artifact renders dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Compile emitted JS and declarations | `pnpm build` | Exit 0 | ✓ PASS |
| Repository regression and phase tests | `pnpm test` | 26 files passed, 1 skipped; 286 tests passed, 25 skipped | ✓ PASS |
| Browser runtime import | `pnpm vitest run --browser --browser.headless tests/hashtree/exports.test.ts` | Chromium: 3 passed, 1 Node-only case skipped | ✓ PASS |
| Release metadata | `pnpm exec changeset status` | Package scheduled for minor bump | ✓ PASS |
| Formatting | `pnpm exec prettier --check src/hashtree tests/hashtree package.json .changeset/hashtree-contracts.md` | All matched files formatted | ✓ PASS |

### Probe Execution

No probes are declared or implied for this phase; the actual packed-package test is part of the Vitest run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PKG-01 | 01-01 | Import Hashtree APIs from the opt-in subpath | ✓ SATISFIED | Exact/wildcard exports, emitted targets, and source/packed import tests pass. |
| PKG-02 | 01-02 | Root does not export, evaluate, or bundle Hashtree | ✓ SATISFIED | Three-dimensional isolation suite passes. |
| PKG-03 | 01-01 | Node/browser portability without Node-only public types | ✓ SATISFIED | Node-types-free declaration compile and Chromium runtime import pass. |
| PKG-04 | 01-01 | Stable typed error families | ✓ SATISFIED | All seven families and base class implemented and tested. |
| TEST-04 | 01-02 | Packed-package subpath and isolation proof | ✓ SATISFIED | Real tarball extraction/self-reference test passes. |

No orphaned Phase 1 requirements were found.

### Anti-Patterns Found

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder, empty implementation, or hardcoded-empty user-output pattern was found in phase source, tests, package metadata, or the required Changeset.

Disconfirmation checks found no partial requirement or misleading phase test. The narrowest remaining risk is that the static ESM graph walker intentionally recognizes TypeScript-emitted literal import/export syntax rather than arbitrary JavaScript; its fail-closed missing-edge test and current `tsc` output make that appropriate for this phase. Error behavior has direct tests for every family and the privacy-sensitive context path.

### Human Verification Required

The implementation and automated evidence pass, but three PLAN prohibitions remain explicitly unresolved. Per the prohibition gate, these are non-authoritative LLM judgments and cannot be silently treated as green:

1. **Node portability prohibition**
   **Test:** Review emitted declarations plus the Node-types-free consumer and Chromium evidence.
   **Expected:** No implicit Node global, polyfill, or `@types/node` requirement exists.
   **Why human:** The PLAN left this negative judgment unresolved.

2. **Sensitive error-context prohibition**
   **Test:** Review public error fields and serialization behavior.
   **Expected:** Raw bytes, credentials, callback inputs, arbitrary context, and serialized causes are not retained.
   **Why human:** The PLAN left this privacy judgment unresolved.

3. **Root-cost prohibition**
   **Test:** Review namespace, evaluation-sentinel, and emitted-graph evidence.
   **Expected:** Root consumers incur no Hashtree export, evaluation, or exclusive dependency cost.
   **Why human:** The PLAN left this transparency judgment unresolved.

### Gaps Summary

No implementation gap was found. Automated checks establish the phase goal, but the overall status remains `human_needed` until the three explicitly unresolved must-not judgments receive human disposition.

---

_Verified: 2026-08-12T10:39:31Z_
_Verifier: the agent (gsd-verifier)_
