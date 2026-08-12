# Phase 2: BUD-15 CHK and Secret-Safe References - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 2-bud-15-chk-and-secret-safe-references
**Areas discussed:** Crypto API, References, Secret Safety

---

## Crypto API

| Question | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Encryption result | Structured result; minimal ciphertext/key; reference-ready result | Minimal `{ ciphertext, key }` |
| Decryption input | Explicit bytes; parsed reference; raw URI | Explicit ciphertext, key, and expected ciphertext hash |
| Key/hash representation | `Uint8Array`; hex strings; accept both | `Uint8Array` only |
| Plaintext/encrypted selection | Separate primitives; one mode-aware function; both layers | Separate functional primitives |

**User's choice:** Keep the functional layer minimal and composable.
**Notes:** The future stateful class API should accept mode-aware options and default to plaintext.

---

## References

| Question | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Parsed shape | Typed CHK fields; encoded parameters; split public/capability objects | Typed fields with decoded key |
| Unknown parameters | Preserve; drop; reject | Preserve |
| Serialization | Canonical ordering; source ordering; semantic-only guarantee | Canonical deterministic ordering |
| Duplicate security parameters | Reject; accept identical duplicates; last wins | Reject strictly |

**User's choice:** References are typed, forward-compatible, and deterministically serialized while security parameters remain strict.
**Notes:** Parsed objects include the decoded key and are therefore bearer capabilities.

---

## Secret Safety

| Question | Alternatives considered | Selected |
|----------|-------------------------|----------|
| Integrity failures | Uniform; stage-specific safe messages; detailed causes | Uniform generic failure |
| Parsed-object logging | Non-enumerable/redacted; plain object; separate redacted view | Plain enumerable data object |
| Callback detail | Public storage metadata; opaque identifiers; opt-in secrets; no callbacks | Public storage metadata only |
| Secret buffers | Preserve caller inputs and wipe temporaries; wipe caller keys; no wiping | Preserve caller inputs and best-effort wipe temporaries |

**User's choice:** Keep public objects conventional while enforcing strict no-secret boundaries in failures and callbacks.
**Notes:** Documentation must clearly identify encrypted parsed references as unsafe to log or serialize indiscriminately.

## the agent's Discretion

- Exact names, internal module layout, canonical parameter order, and best-effort temporary-buffer wiping technique.

## Deferred Ideas

None.
