# Project Research Summary

**Project:** Blossom Client SDK Hashtree Support  
**Domain:** Experimental BUD-15 through BUD-18 client-side hashtree support for a TypeScript ESM Blossom SDK  
**Researched:** 2026-07-25  
**Confidence:** MEDIUM overall; local SDK architecture is clear, while upstream BUD PRs #104-#107 remain open drafts.

## Executive Summary

This milestone adds experimental end-to-end hashtree support to `blossom-client-sdk`: CHK encryption for Blossom blobs, deterministic MessagePack manifests, chunked file and directory fanout trees, immutable `nhash` references, mutable `htree://<npub>/<tree>/<path>` references, and upload/download APIs that compose existing Blossom HTTP actions. Experts should build this as a client-side protocol layer over ordinary Blossom blobs, not as new server behavior or a relay/database/sync subsystem.

The recommended approach is a minimal, layered TypeScript implementation: keep byte-level BUD primitives pure and heavily vector-tested; compose network behavior in `src/actions/hashtree.ts` using existing `uploadBlob`, `downloadBlob`, and `multiServerUpload`; expose the API behind an explicit experimental `Hashtree` namespace and `./hashtree` subpath. Add only `@msgpack/msgpack` for BUD-16/17 manifests and `@scure/base` for BUD-18 `nhash`; use native `globalThis.crypto.subtle` for BUD-15 CHK first, with no crypto fallback unless tests prove one is needed.

The highest risks are cryptographic misuse, non-canonical manifest bytes, draft spec churn, and recursive untrusted-fetch behavior. Mitigate them by implementing CHK first with no arbitrary key encryption API, locking manifest encoding behind one canonical codec with exact byte vectors, isolating BUD constants and visibility semantics, enforcing traversal/download limits, and requiring caller-injected server/relay policy callbacks before honoring hints from `htree://`, manifests, or root events.

## Key Findings

### Recommended Stack

Keep the runtime stack small and Web API-first. The SDK already targets Node >=18, browsers, ESM, `Blob`/`Uint8Array`, `fetch`, and DOM-compatible types; hashtree support should preserve that shape and avoid Node-only runtime APIs. Source imports must keep `.js` suffixes because `tsconfig.json` uses `NodeNext`.

**Core technologies:**
- `@noble/hashes` `^1.8.0` — existing SHA-256/hex primitive; use for `chk_key = SHA256(plaintext)`, blob hashes, and equality checks.
- Web Crypto `globalThis.crypto.subtle` — AES-256-GCM and HKDF-SHA256 for BUD-15; preserves Node 18/browser compatibility and avoids `node:crypto`.
- `@msgpack/msgpack` `^3.1.2` — new production dependency for BUD-16/BUD-17 MessagePack bytes; wrap it with SDK-owned canonicalization rather than relying on library key sorting.
- `@scure/base` `^2.2.0` — new production dependency for BUD-18 `nhash` bech32 encode/decode; lighter and more appropriate than adding `nostr-tools` at runtime.
- Platform binary APIs (`Blob`, `ReadableStream`, `Uint8Array`, `ArrayBuffer`, `TextEncoder`, `TextDecoder`) — normalize internally to `Uint8Array`, keep public APIs Blob-friendly.

**Do not add:** production `nostr-tools`, relay clients, `node:crypto`, `msgpack-lite`, CBOR, FlatBuffers, WASM crypto, or a persistent storage dependency for v1.

### Expected Features

**Must have (table stakes):**
- Experimental public API surface under a clear namespace/subpath; do not imply stable API guarantees while PRs #104-#107 are open.
- BUD-15 CHK encrypt/decrypt with `chk_key = SHA256(plaintext)`, HKDF-SHA256, AES-256-GCM zero nonce, ciphertext hash validation, and plaintext hash validation.
- BUD-15 `blossom:` encrypted blob parameter helpers (`enc=chk-v1`, `k=<chk_key>`) without leaking keys to servers.
- BUD-16 deterministic MessagePack encode/decode for tree nodes with exact field order, UTF-8 byte sorting, bin-vs-string correctness, metadata validation, and vector tests.
- BUD-16 directory creation, validation, listing, and path traversal.
- BUD-17 chunked file creation/download with 2 MiB chunks, max 174 links per node, per-chunk encryption keys, ordered reassembly, and directory `t = 3` fanout support.
- BUD-18 immutable `nhash` and `htree://<nhash>/<path>` parsing/building/resolution.
- BUD-18 mutable `htree://<npub>/<tree-name>/<path>` parsing/building, root event templates for kind `30064`, and callback-injected mutable root resolution.
- BUD-18 public, link-private, and owner-private visibility modes; owner-private NIP-44 operations must be injected by callbacks.
- End-to-end upload, resolve, download/decrypt, and directory listing APIs that compose existing Blossom actions and propagate auth/payment/timeout/signal behavior.
- Safety limits for manifest size, link count, recursion depth, aggregate bytes, path segments, and concurrent downloads.

**Should have (differentiators):**
- Two-layer API: pure primitives and batteries-included actions.
- Multi-server hashtree upload/mirroring using `src/actions/multi-server.ts`.
- Manifest-first dry run/upload plan for payment UX and predictable upload counts.
- Progress and partial-result callbacks with contextual hashes/path/manifest metadata.
- Selective path lookup over `t = 3` fanout without downloading entire large directories.
- Owner recovery helpers for link-private roots via injected NIP-44 callbacks.

**Defer (v2+ / out of scope):**
- Server-side Blossom endpoint changes.
- Built-in relay client or relay pool integration.
- Persistent cache/database, full sync client, filesystem watcher, or filesystem materialization API.
- Gateway HTTP server.
- Stable non-experimental API promises before upstream BUDs merge.
- Legacy draft writer compatibility; write current kind `30064` and structural `t = 3`, read legacy only where cheap and isolated.

### Architecture Approach

Add hashtree as an experimental protocol area parallel to existing Blossom HTTP actions. Keep byte-oriented codecs and builders pure; keep HTTP/auth/payment behavior in actions; keep Nostr root lookup/publish callback-injected. Do not fold `htree://` into existing `blossom:` URI helpers or `resolveBlob`, because hashtree resolution includes recursive manifests, decryption, path traversal, optional Nostr root lookup, and safety policy.

**Major components:**
1. CHK crypto helper — deterministic BUD-15 encrypt/decrypt, key derivation, zero nonce invariant, and both hash validation checks.
2. Manifest codec — deterministic BUD-16/BUD-17 MessagePack encode/decode, canonical ordering, link/type validation, and safety limits.
3. Chunking/tree builder — 2 MiB file chunks, max 174 links, file manifests, directories, and structural `t = 3` fanout.
4. Hashtree reference helpers — BUD-18 `htree://`, `nhash` bech32 TLV, legacy 32-byte hash-only decode, path/key parsing.
5. Hashtree action orchestration — upload/download/list/resolve using existing `uploadBlob`, `downloadBlob`, `multiServerUpload`, auth, payment, timeout, and abort patterns.
6. Mutable root helpers — kind `30064` event templates and controlled read compatibility with `30078`; relay lookup and NIP-44 crypto are caller-provided.
7. Experimental facade/exports — `src/hashtree.ts` or `src/hashtree/index.ts`, `src/index.ts` namespace export, and `package.json` subpath export.

**Recommended file paths from research:**
- Prefer one coherent hashtree area such as `src/hashtree/chk.ts`, `src/hashtree/manifest.ts`, `src/hashtree/file.ts`, `src/hashtree/directory.ts`, `src/hashtree/traverse.ts`, `src/hashtree/refs.ts`, `src/hashtree/roots.ts`, `src/hashtree/visibility.ts`, `src/hashtree/types.ts`, `src/hashtree/index.ts`, and `src/actions/hashtree.ts`.
- If following the current helper layout more strictly, equivalent helper paths are `src/helpers/hashtree-chk.ts`, `src/helpers/hashtree-manifest.ts`, `src/helpers/hashtree-builder.ts`, and `src/helpers/hashtree-uri.ts`.
- Update `src/actions/index.ts`, `src/helpers/index.ts` if helpers are public, `src/index.ts`, `package.json`, and possibly `src/const.ts`/`src/nostr.ts` for pure constants/event helpers only.

### Critical Pitfalls

1. **AES-GCM zero nonce key reuse** — never expose encryption with arbitrary keys and never reuse a file-level key across chunks; derive the CHK key from each exact plaintext blob/chunk.
2. **Missing commitment checks** — verify `SHA256(ciphertext) == blob_hash` before decrypt and `SHA256(plaintext) == chk_key` after decrypt; fail closed with typed errors.
3. **Non-canonical MessagePack bytes** — centralize encoding, emit exact BUD field order, sort directory links and metadata by UTF-8 bytes, preserve file chunk order, and test exact bytes/hashes.
4. **Directory fanout ambiguity** — write structural `t = 3`; do not infer fanout from `_chunk_*` names; isolate any old draft read compatibility.
5. **Mutable root kind/staleness errors** — write kind `30064`, optionally read legacy `30078` only after preferring `30064`, and require replaceable-event selection by `(pubkey, kind, d)` with latest valid event.
6. **Untrusted fetch targets and recursion** — add allowlist/filter callbacks, traversal limits, visited sets, byte accounting, and bounded concurrency before recursive downloads.
7. **Existing upload fallback metadata bug** — review/fix or work around `uploadBlob()` direct `PUT /upload` fallback headers before relying on it for many ciphertext chunks/manifests.

## Implications for Requirements and Roadmap

The roadmap should be dependency-first and vector-first. Do not start with public exports or end-to-end upload; those depend on cryptographic and canonical-byte foundations. Split work into phases that keep pure protocol correctness isolated from network orchestration and draft Nostr semantics.

### Phase 1: CHK Crypto Primitives and URI Key Helpers
**Rationale:** BUD-15 is the security foundation for encrypted blobs, encrypted chunks, manifest keys, and root-key handling.  
**Delivers:** `encryptChk`, `decryptChk`, `deriveChkKey`, ciphertext/plaintext hash validation, `enc=chk-v1`/`k` parse-build helpers, negative tests.  
**Addresses:** BUD-15 CHK support and encrypted Blossom URI key support from `.planning/PROJECT.md` active requirements.  
**Avoids:** zero-nonce key reuse, missing commitment checks, server key leakage.  
**Research flag:** Needs focused implementation research only if Web Crypto HKDF/AES-GCM parity fails in Node 18/browser vectors; otherwise standard Web Crypto patterns.

### Phase 2: Deterministic Manifest Codec and Validation
**Rationale:** Every tree hash, `nhash`, upload plan, and resolver depends on byte-identical BUD-16/BUD-17 manifests.  
**Delivers:** canonical MessagePack encoder/decoder, typed nodes/links/metadata, exact vectors, shuffled directory invariance tests, malformed decode rejection.  
**Uses:** `@msgpack/msgpack` wrapped by SDK canonical builders.  
**Avoids:** non-canonical manifest hashes, bin/string drift, unknown type coercion.  
**Research flag:** Needs `/gsd-plan-phase --research-phase` if upstream PR #105 test vectors or field-order semantics have changed since 2026-07-25.

### Phase 3: Chunking, Directory Builder, Fanout, and Traversal Limits
**Rationale:** BUD-17 depends on CHK and canonical manifests; it provides the file/directory scale layer required before network APIs.  
**Delivers:** 2 MiB chunking, max 174 links, file manifests, directory manifests, structural `t = 3` fanout, path traversal/listing, recursion/byte limits, large-file tests.  
**Addresses:** chunked large file creation/download, directory fanout, directory listing/path traversal, safety limits.  
**Avoids:** per-file CHK key reuse, `_chunk_*` fanout ambiguity, unbounded recursion, whole-blob memory assumptions.  
**Research flag:** Needs phase research for current BUD-17 fanout type (`t = 3` vs old draft `t = 2`) because `.planning/PROJECT.md` still mentions older `t = 2`/`_chunk_<start>` wording while research files recommend `t = 3`.

### Phase 4: Immutable References and Local Resolution
**Rationale:** Immutable `nhash` and `htree://<nhash>/<path>` are deterministic and avoid relay complexity; they are the safest first end-to-end read path.  
**Delivers:** `parseNhash`, `encodeNhash`, TLV validation, legacy 32-byte decode, immutable `htree://` parsing/building, local manifest traversal by root hash/key.  
**Uses:** `@scure/base` bech32 and BUD-18-local TLV codec.  
**Avoids:** NIP-19 TLV confusion, malformed root-key handling, path parse bugs.  
**Research flag:** Needs research if PR #107 changes TLV type table or bech32 length/vector values; otherwise standard codec work.

### Phase 5: End-to-End Upload/Download Actions
**Rationale:** After local bytes and references are correct, compose with existing HTTP actions so auth/payment/retry behavior remains consistent.  
**Delivers:** `createHashtree` upload plan, `uploadHashtree`, optional `multiServerUploadHashtree`, `resolveHashtree`, `downloadHashtreeFile`, `listHashtreeDirectory`, fetch-mock tests, progress callbacks, server-hint policy hooks.  
**Addresses:** user requirement for end-to-end APIs, multi-server mirroring, server hints/fallbacks, callback propagation.  
**Avoids:** changing Blossom server behavior, untrusted recursive fetches, upload fallback metadata bugs, auth/payment callback ambiguity.  
**Research flag:** Standard existing SDK patterns, but inspect/fix `src/actions/upload.ts` fallback header behavior before relying on direct PUT flows.

### Phase 6: Mutable Roots and Visibility Modes
**Rationale:** Mutable roots combine BUD-18 event semantics, link-private/owner-private keys, callbacks, and draft churn; isolate them after immutable resolution and upload/download work.  
**Delivers:** kind `30064` root event templates, mutable `htree://<npub>/<tree-name>/<path>` parser/builder, root resolver callback contract, public/link-private/owner-private visibility helpers, injected NIP-44 owner-private callbacks, optional legacy `30078` reader compatibility.  
**Addresses:** all BUD-18 mutable visibility modes and mutable root resolution.  
**Avoids:** built-in relay dependency, stale/incorrect root resolution, leaking link-private keys, API churn from draft changes.  
**Research flag:** High priority for `/gsd-plan-phase --research-phase`; validate current PR #107 event tags, kind, key tags, and visibility semantics immediately before planning.

### Phase 7: Experimental Public Exports, Docs, and Build Smoke Tests
**Rationale:** Delay broad public surfacing until behavior and types are proven; then expose a coherent experimental import surface.  
**Delivers:** `src/index.ts` namespace export, `package.json` `./hashtree` export, action/helper barrels as appropriate, `@experimental` TypeDoc tags, README notes, built-package import tests, `pnpm build` verification.  
**Addresses:** experimental public API surface and TypeScript consumer ergonomics.  
**Avoids:** stable API accidents and package export drift.  
**Research flag:** Standard repository pattern; skip deeper research unless export map shape changes during implementation.

### Phase Ordering Rationale

- CHK crypto must come before encrypted chunks, encrypted manifests, `k` handling, and visibility modes.
- Canonical MessagePack must come before any upload/download workflow because manifest hashes are content addresses.
- BUD-17 chunking/fanout depends on both CHK and manifest codec and should be tested locally before HTTP orchestration.
- Immutable references are lower-risk than mutable roots and create a usable end-to-end read path without relay dependencies.
- Network actions should compose existing action modules only after local tree construction and traversal are stable.
- Mutable roots and visibility modes are most exposed to PR #107 churn, so they should be late and isolated.
- Public exports/docs should be last to avoid locking accidental API shapes.

### Requirements Implications

- Requirements should explicitly say writers emit current structural directory fanout (`t = 3`) and root kind `30064`; legacy `30078` or old fanout reads are compatibility-only and optional.
- Requirements should include exact vector coverage for PRs #104, #105, #106, and #107, plus negative vectors for integrity failures and malformed data.
- Requirements should include secure-context/browser Web Crypto assumptions and Node >=18 compatibility.
- Requirements should include server/relay hint policy callbacks for any recursive or externally provided fetch targets.
- Requirements should require all high-level APIs to propagate existing `auth`, `authEvents`, `onAuth`, `onPayment`, `timeout`, `signal`, and multi-server behavior where applicable.
- Requirements should call out `src/actions/upload.ts` fallback metadata behavior as a prerequisite audit item before high-volume hashtree uploads.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Validate latest BUD-16 PR #105 vectors and canonical field-order rules.
- **Phase 3:** Validate latest BUD-17 PR #106 chunk/fanout constants and reconcile `t = 3` research with older `.planning/PROJECT.md` `t = 2` wording.
- **Phase 4:** Validate latest BUD-18 PR #107 `nhash` TLV table, legacy payload rule, and vectors.
- **Phase 6:** Validate BUD-18 PR #107 mutable root event tags, kind `30064`, optional `30078` compatibility, and visibility key semantics.

Phases with standard patterns where research can usually be skipped:
- **Phase 1:** Web Crypto implementation patterns are standard if current vectors are available.
- **Phase 5:** Existing SDK action composition, fetch mocks, auth/payment retry patterns, and multi-server upload are already mapped locally.
- **Phase 7:** Existing package export/barrel/TypeDoc patterns are local repository work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | LOW | Dependency recommendations are actionable and locally consistent, but upstream specs are draft and stack source quality was classified LOW. |
| Features | MEDIUM | Feature set is strongly supported by `.planning/PROJECT.md`, local code paths, and PR draft text, but BUD details may change. |
| Architecture | MEDIUM | Existing SDK layer boundaries are clear; risk is primarily draft churn and choosing final file layout. |
| Pitfalls | MEDIUM | Local risks are concrete; unmerged PR details and web-fetched context remain lower confidence. |

**Overall confidence:** MEDIUM.

### Gaps to Address

- **Spec drift in open BUD PRs #104-#107:** Re-check raw PR drafts immediately before each protocol phase, especially vectors, constants, event kinds, and visibility tags.
- **BUD-17 fanout wording conflict:** `.planning/PROJECT.md` mentions `t = 2`/`_chunk_<start>` while research recommends structural `t = 3`; decide explicitly during requirements and update `PROJECT.md` if confirmed.
- **Web Crypto parity:** Validate HKDF/AES-GCM in Node 18 and browser runners before deciding whether an optional `@noble/ciphers` fallback is necessary.
- **Upload fallback headers:** Audit `src/actions/upload.ts` direct `PUT /upload` metadata behavior before bulk hashtree upload tests.
- **Public file layout:** Research splits between `src/hashtree/*` and `src/helpers/hashtree-*`; requirements/roadmap should choose one consistent layout that matches existing exports and test ergonomics.
- **Server/relay policy model:** Define option names and default behavior for honoring embedded server hints or root-event relay hints before end-to-end resolver implementation.

## Sources

### Primary local context
- `.planning/PROJECT.md` — milestone scope, active requirements, constraints, and PR references.
- `.planning/research/STACK.md` — dependency/runtime recommendations and verification stack.
- `.planning/research/FEATURES.md` — table stakes, differentiators, anti-features, API shape, and feature dependencies.
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, module/export plan, and build order.
- `.planning/research/PITFALLS.md` — critical/moderate/minor pitfalls and phase-specific warnings.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md` — referenced by research files for existing SDK patterns.

### Local implementation references
- `package.json` — current dependencies, Node engine, ESM exports, scripts.
- `tsconfig.json` — ES2022, DOM, and NodeNext constraints.
- `src/index.ts` — root public barrel; should export hashtree as namespace, not flatten all primitives.
- `src/actions/index.ts` — action public barrel; add hashtree action export when network layer lands.
- `src/helpers/index.ts` — helper barrel if low-level hashtree helpers are public.
- `src/helpers/blob.ts` — existing SHA-256/blob hashing behavior and whole-blob memory caveat.
- `src/helpers/blossom-uri.ts` — existing `blossom:` parser; do not mix with `htree://` semantics.
- `src/actions/upload.ts` — upload preflight/auth/payment and fallback header risk.
- `src/actions/download.ts` — raw blob download behavior to compose and verify at hashtree layer.
- `src/actions/resolve.ts` — existing `blossom:` resolver/fallback patterns, not a place for hashtree traversal.
- `src/actions/multi-server.ts` — reuse for chunk/manifest mirroring.
- `src/auth.ts`, `src/nostr.ts`, `src/types.ts` — existing Nostr auth/event types and callback-oriented patterns.
- `tests/fetch.ts`, `tests/mock-servers.ts`, `tests/actions/*`, `tests/helpers/*` — fetch mock and unit/orchestration test patterns.

### Upstream PR references
- BUD-15 PR #104 — `https://github.com/hzrd149/blossom/pull/104`; CHK encryption (`chk-v1`), deterministic AES-GCM/HKDF, ciphertext hashes, `enc`/`k` URI parameters, security review notes.
- BUD-16 PR #105 — `https://github.com/hzrd149/blossom/pull/105`; deterministic MessagePack directory manifests, fields, sorting, path resolution, safety limits, vectors.
- BUD-17 PR #106 — `https://github.com/hzrd149/blossom/pull/106`; chunked file manifests, 2 MiB chunks, max 174 links, directory fanout, encrypted child keys, vectors.
- BUD-18 PR #107 — `https://github.com/hzrd149/blossom/pull/107`; `htree://`, `nhash` bech32 TLV, kind `30064`, optional legacy `30078`, and visibility modes.
- Raw draft references captured in `.planning/research/FEATURES.md`: `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-15-chk-encryption/buds/15.md`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-16-directory-manifests/buds/16.md`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-17-chunked-manifests/buds/17.md`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-18-hashtree-references/buds/18.md`.

### Package/API docs referenced by stack research
- `@msgpack/msgpack` README — TypeScript/browser/Node MessagePack support, `encode`/`decode`, byte-array behavior, decoder limits.
- `@scure/base` npm package — bech32 support, TypeScript declarations, zero dependencies.
- Node Web Crypto documentation and MDN SubtleCrypto documentation — HKDF, AES-GCM, SHA-256, and `globalThis.crypto.subtle` runtime behavior.

---
*Research completed: 2026-07-25*  
*Ready for roadmap: yes*
