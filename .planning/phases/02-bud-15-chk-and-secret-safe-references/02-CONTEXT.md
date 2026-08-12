# Phase 2: BUD-15 CHK and Secret-Safe References - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement portable standalone BUD-15 CHK encryption and decryption primitives, strict encrypted `blossom:` reference parsing/building, and the secret-safety contracts needed for plaintext and encrypted Hashtree workflows. Directory encoding, file DAG construction, roots, storage orchestration, and stateful client implementation belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Functional crypto API
- **D-01:** The standalone encryption primitive returns only `{ ciphertext, key }`. Hashing and reference construction remain separate composable operations. — **Reversibility:** costly — Expanding the published result shape later changes the public functional contract and downstream expectations.
- **D-02:** The standalone decryption primitive receives explicit ciphertext bytes, key bytes, and the expected ciphertext hash. It does not accept or parse a URI.
- **D-03:** Low-level CHK keys and hashes use strict `Uint8Array` values; string encoding and decoding belong to reference helpers.
- **D-04:** Plaintext behavior and CHK encryption remain separate functional primitives rather than one mode-aware function.
- **D-05:** The future stateful class API accepts mode-aware options and defaults to plaintext. This phase may define the shared option contract, but does not implement the later client classes.

### Encrypted Blossom references
- **D-06:** Parsing an encrypted `blossom:` reference returns validated typed CHK fields, including the encryption mode and a decoded `Uint8Array` key, together with standard Blossom metadata. — **Reversibility:** costly — The parsed shape becomes a public capability-bearing contract used by callers.
- **D-07:** Unknown query parameters and repeated values are preserved through parsing and rebuilding for forward compatibility.
- **D-08:** Builders emit recognized parameters in a fixed documented order, followed by preserved extension parameters in deterministic key/value order.
- **D-09:** Security-sensitive `enc` and `k` parameters must each occur exactly once where required. Duplicate or conflicting values are validation errors; no first-value or last-value rule applies.

### Secret safety
- **D-10:** Ciphertext-address, GCM-authentication, and plaintext-CHK failures expose the same generic public integrity failure. Do not reveal the failed stage or attach underlying cryptographic causes.
- **D-11:** Parsed encrypted references are ordinary plain data objects whose key is enumerable. Document the entire object as capability-bearing and unsafe to log or serialize indiscriminately.
- **D-12:** Routine progress and diagnostic callbacks may receive public storage metadata such as operation, byte counts, ciphertext hash, and non-secret mode. They must never receive plaintext, keys, full encrypted URIs, or secret-bearing parsed objects.
- **D-13:** Never mutate caller-owned secret byte arrays. Copy when necessary and wipe internal derived-key buffers on a best-effort basis after use.

### the agent's Discretion
- Exact function and type names, provided they remain descriptive, standalone, and consistent with the Phase 1 public API decisions.
- Exact canonical query-parameter ordering, provided it is fixed, documented, and deterministic.
- Internal cryptographic helper structure and best-effort buffer-wiping mechanics, subject to exact BUD-15 bytes and browser/Node portability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and protocol requirements
- `.planning/PROJECT.md` — Defines BUD-15 algorithm intent, portability, subpath isolation, functional-first architecture, and milestone constraints.
- `.planning/REQUIREMENTS.md` — CHK-01 through CHK-06 are the fixed Phase 2 requirements.
- `.planning/ROADMAP.md` — Defines the Phase 2 boundary, dependency, goal, and success criteria.
- `.planning/phases/01-packaging-boundary-and-protocol-contracts/01-CONTEXT.md` — Locks the public byte, error, naming, cancellation, and package-boundary contracts inherited by this phase.

### Repository contracts and existing implementation
- `AGENTS.md` — Defines repository shape, export behavior, verification commands, formatting, tests, and release workflow.
- `src/hashtree/types.ts` — Current portable Hashtree contracts and callback conventions.
- `src/hashtree/errors.ts` — Existing safe typed-error hierarchy that CHK failures must use.
- `src/helpers/blossom-uri.ts` — Existing Blossom URI model and parsing/building behavior to extend or supersede within the isolated Hashtree surface.

No local external BUD-15 specification or vector document is currently referenced by the roadmap. Research must locate and pin the authoritative draft and official vectors before planning the algorithm.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hashtree/types.ts`: Supplies `Uint8Array`-based portable contracts, `MaybePromise`, callback types, and `AbortSignal` options.
- `src/hashtree/errors.ts`: Supplies `HashtreeValidationError` and `HashtreeIntegrityError` with narrow safe context fields.
- `src/helpers/blob.ts`: Existing SHA-256 utilities and `@noble/hashes` dependency provide hashing precedent, though CHK needs exact byte-oriented behavior.
- `src/helpers/blossom-uri.ts`: Existing parsing and building logic covers hashes, extensions, server hints, authors, and sizes.

### Established Patterns
- TypeScript NodeNext ESM modules use `.js` specifiers and emit declarations to `lib/`.
- Public bytes use `Uint8Array`; browser and Node portability relies on Web APIs rather than Node-only types.
- Specialized Hashtree code is reachable only through `blossom-client-sdk/hashtree` and focused wildcard subpaths, never through the root barrel.
- Public errors preserve class identity and narrowly selected safe fields rather than generic context or error codes.

### Integration Points
- Add focused modules under `src/hashtree/` and re-export their curated public symbols from `src/hashtree/index.ts` without touching `src/index.ts`.
- Extend the Hashtree URI functionality without silently changing the established root/helper Blossom URI API unless planning proves that compatibility is intended.
- Add node and browser-capable vector, tamper, parsing, canonicalization, and secret-leak tests under `tests/hashtree/`.
- Preserve the Phase 1 emitted-graph and packed-package isolation proofs when adding any cryptographic dependency.

</code_context>

<specifics>
## Specific Ideas

- Keep crypto, hashing, and URI creation separately composable even though encrypted references bring those results together at a higher layer.
- Stateful APIs introduced later should make mode selection ergonomic while retaining plaintext as their default.
- Treat parsed encrypted reference objects themselves as bearer capabilities; safety comes from clear contracts and strict callback/error boundaries, not hidden object fields.

</specifics>

<deferred>
## Deferred Ideas

None — the stateful class mode preference was captured as a future API contract already required by CHK-06, while class implementation remains in its scheduled later phase.

</deferred>

---

*Phase: 2-bud-15-chk-and-secret-safe-references*
*Context gathered: 2026-08-12*
