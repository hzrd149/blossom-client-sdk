# Project Research Summary

**Project:** blossom-client-sdk — Hashtree Support
**Domain:** Portable TypeScript SDK for BUD-15/16/17/18 Hashtrees over Blossom and Nostr
**Researched:** 2026-08-09
**Confidence:** MEDIUM

## Executive Summary

This milestone adds a complete, opt-in Hashtree implementation to an existing portable TypeScript ESM SDK. Experts build this as a functional protocol core beneath a stateful client shell: byte-exact CHK cryptography and canonical MessagePack first; deterministic file/directory DAGs and bounded traversal next; BUD-18 references and mutable-root rules after that; storage, commits, and reactive client ergonomics only once the underlying identities are stable. The public surface belongs exclusively at `blossom-client-sdk/hashtree`; the package root must neither export nor evaluate it.

Use the existing TypeScript/Web Platform baseline, `@noble/hashes`, WebCrypto, and WHATWG streams. Add only `@msgpack/msgpack@^3.1.3` and Node-18-compatible `@scure/base@^1.2.6`. Neither dependency owns protocol canonicalization: SDK code must construct fields in BUD order, sort strings by encoded UTF-8 bytes, validate decoded `unknown` values and resource budgets, and prove exact bytes with official vectors and reference-implementation fixtures.

The dominant risks are irreversible interoperability errors, capability-key disclosure, attacker-controlled graph exhaustion, and distributed commit races. Prevent them with strict canonical adapters, a single verify-before-use pipeline, secret-aware reference handling, bounded iterative traversal, upload-before-publish commits, revision-scoped state, and deterministic Nostr event reduction. Confidence is medium because BUD-15/16/17/18 remain open drafts and several client policies are product decisions; pin fixtures to cited PR heads and re-check them before implementation and release.

## Key Findings

### Recommended Stack

Keep the current ES2022/NodeNext TypeScript library and browser/Node 18 portability contract. Use web-native bytes, crypto, streams, blobs, and abort signals; do not expose `Buffer`, Node streams, or `node:crypto` in Hashtree APIs. Details and version evidence are in [STACK.md](./STACK.md).

**Core technologies:**

- **TypeScript `^5.8.3`:** public contracts and implementation — preserves the existing ESM/declaration build and discriminated type model.
- **WebCrypto (`globalThis.crypto.subtle`):** HKDF-SHA256 and AES-256-GCM — portable across supported Node and browser targets; fail clearly if unavailable.
- **WHATWG `ReadableStream<Uint8Array>`:** primary large-file read surface — supports bounded buffering, backpressure, cancellation, and browser composition.
- **`@noble/hashes@^1.8.0`:** incremental SHA-256 and byte utilities — already installed and suitable for chunk-oriented hashing.
- **`@msgpack/msgpack@^3.1.3`:** low-level MessagePack codec — hide behind a strict BUD adapter with `sortKeys: false`, explicit ordered DTOs, and decoder limits.
- **`@scure/base@^1.2.6`:** bech32 words/checksum for `npub` and `nhash` — remain on 1.x while Node 18 is supported and pass an explicit keyed-`nhash` length bound.
- **Explicit `./hashtree` package export:** module isolation — never add a root-barrel re-export or runtime edge from existing modules.

Critical version requirements are Node 18 compatibility, `@scure/base` 1.x rather than 2.x, and exact-vector verification of the selected MessagePack version. Add a minor Changeset for this published API.

### Expected Features

The milestone deliberately has two tiers: reusable stateless protocol functions first, then a client that composes them. Details are in [FEATURES.md](./FEATURES.md).

**Must have (table stakes):**

- Isolated `./hashtree` entrypoint with portable public types and typed errors.
- Full BUD-15 CHK encryption/decryption, `blossom:` parameters, per-chunk keys, both mandatory hash checks, and official vectors.
- Canonical BUD-16 MessagePack, strict node/link/name/metadata validation, and segment-safe path traversal.
- Canonical BUD-17 2 MiB chunking, 174-link file/directory fanout, bounded graph traversal, streaming reads, and explicit `Blob` convenience.
- BUD-18 `htree`/`nhash`, deterministic mutable-root selection/publication, and public, link-private, and owner-private visibility.
- Callback-injected Blossom, Nostr, signer, subscription, and NIP-44 integration; no relay-library runtime dependency.
- Interoperability fixtures against the official vectors and published reference implementation.
- Shared `HashtreeClient`, independently loadable/unloadable mutable or immutable handles, bounded caches, and lifecycle cleanup.
- Staged `fs/promises`-like reads and mutations, metadata operations, inspectable dirty state, retry-safe explicit commit, and local/remote async updates with divergence reporting.

**Should have (competitive, after the v1 contracts stabilize):**

- Pluggable persistent cache adapter after in-memory keying, invalidation, and secret handling are proven.
- Range reads for demonstrated random-access/media demand.
- Tree diff and commit-preview helpers built on stable staged-operation types.
- Optional framework/RxJS adapters outside the portable core.
- Isolated legacy-read compatibility beyond the draft-required forms, never emitted by canonical writers.

**Defer (v2+):**

- Collaborative merge/CRDT strategies — BUD-18 defines replacement, not merge semantics.
- Offline durable workspaces — require persistence, migration, replay, and key-protection design.
- Garbage-collection/reachability planning and gateway/local-filesystem adapters — useful adjacent products, not protocol completion.
- Auto-commit, built-in relay pools, Node `fs` parity, unbounded caches, and sending keys to Blossom are anti-features, not backlog items.

### Architecture Approach

Use a strict downward dependency graph: public functional exports and client facades compose orchestration services; services compose protocol primitives and injected adapters; primitives know nothing about network, clients, or the root package barrel. Committed content is an immutable hash-addressed DAG, while each loaded mutable tree owns a base-root snapshot plus a staged copy-on-write overlay. Details are in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**

1. **Protocol model and errors** — branded hashes/keys, node/reference unions, constants, limits, and stable error taxonomy.
2. **CHK codec** — exact BUD-15 construction and the mandatory ciphertext-hash/decrypt/plaintext-hash pipeline.
3. **Manifest codec** — canonical BUD-16 wire objects plus strict decode-to-unknown validation.
4. **DAG builders/readers** — BUD-17 file chunking, directory fanout, structural checks, budgets, and verified ordered streaming.
5. **Reference/root functions** — pure `htree`/`nhash` parsing, root-event validation/selection, and visibility-key recovery.
6. **Storage and Nostr ports** — narrow adapters over existing Blossom actions and caller-provided query/publish/subscribe/sign/NIP-44 callbacks.
7. **Resolver, mutation overlay, and commit planner** — central verify-before-use reads and prepare/upload/publish/finalize writes.
8. **`LoadedHashtree` and `HashtreeClient`** — tree-local state, caches, staging, lifecycle, update queue, and shared configuration/registry.

**Key patterns:** functional core/stateful shell; immutable DAG plus tree-local overlay; hash-and-key-scoped caches with root-revision path indexes; bounded traversal shared across recursive work; upload all required objects before publishing a kind-30064 root; and subscribe-first/backfill through one validated, deduplicating event reducer.

### Critical Pitfalls

The complete catalog and verification matrix are in [PITFALLS.md](./PITFALLS.md).

1. **Protocol-correct-looking bytes that are not canonical** — own CHK and MessagePack adapters, disallow arbitrary writer key/nonce, emit exact field order/minimal integers/bin values, sort by UTF-8 bytes, and assert exact vectors in Node and Chromium.
2. **Using data before complete integrity verification** — require ciphertext-address verification before decryption and plaintext/CHK verification afterward; authenticate each bounded chunk fully before yielding it.
3. **Bearer-key leakage** — parse keys into secret-aware values, build Blossom requests from ciphertext hashes only, redact references/errors/cache diagnostics, and encrypt parent manifests when structure is private.
4. **Unbounded or ambiguous hostile traversal** — strictly validate every decoded structure and path segment, reject unknown types and duplicates, and enforce global depth/bytes/manifests/links/concurrency budgets with cycle detection.
5. **State and publication races** — scope caches to hash/key/root revision, snapshot stage generations, upload children and parents before publishing, retain stages on failure, serialize commits/root transitions, and surface remote divergence instead of silently overwriting.

## Implications for Roadmap

Based on the combined research, use eight phases. Each phase should end in observable tests, not merely implemented modules.

### Phase 1: Packaging Boundary and Protocol Contracts

**Rationale:** Module isolation, public value types, errors, constants, and finite limits constrain every later API and prevent accidental root-package coupling.
**Delivers:** `src/hashtree` structure, explicit `./hashtree` export, dependencies, byte/path utilities, branded types, errors, and built-package/root-isolation smoke tests.
**Addresses:** Dedicated entrypoint, portable types, callback contracts, path/name foundations.
**Avoids:** A source-only subpath that fails in `lib`, root bundle bloat, Node-only public APIs, and inconsistent limits.

### Phase 2: BUD-15 CHK and Secret-Safe References

**Rationale:** Encrypted manifests, chunks, and private roots all depend on exact CHK behavior; crypto errors contaminate every downstream hash.
**Delivers:** CHK encrypt/decrypt, `blossom:` parameters, secret redaction, mandatory verification order, and Node/browser official-vector tests.
**Addresses:** BUD-15, per-chunk encryption, plaintext/encrypted mode primitives.
**Avoids:** Arbitrary key with zero nonce, plaintext-address uploads, incomplete AEAD verification, and capability leakage.

### Phase 3: BUD-16 Canonical Codec and Traversal Model

**Rationale:** Stable manifest bytes and strict runtime validation are prerequisites for every BUD-17 builder and filesystem operation.
**Delivers:** Canonical MessagePack adapter, node/link/metadata validators, UTF-8 ordering, segment-safe paths, directory traversal, and malformed-input/vector suite.
**Addresses:** Canonical codec, typed traversal, names, metadata, and domain errors.
**Avoids:** Generic encoder defaults, permissive decoding, duplicate-name ambiguity, UTF-16 ordering, and path separator/traversal confusion.

### Phase 4: BUD-17 DAG Construction, Bounded Resolution, and Streaming

**Rationale:** The file/directory data plane must be deterministic, safe, and memory-bounded before storage or client state wraps it.
**Delivers:** 2 MiB chunking, 174-link recursive file/directory fanout, raw-small-file optimization, iterative budgeted traversal, cycle/repeated-work handling, verified ordered streams, and `Blob` collector.
**Addresses:** Canonical file/directory construction, resource limits, streaming reads, plaintext/encrypted parity.
**Avoids:** Noncanonical roots, fake streaming, unauthenticated output, request amplification, cycles, excessive allocations, and exposing internal fanout nodes.

### Phase 5: BUD-18 Identifiers, Roots, and Visibility

**Rationale:** Mutable naming and privacy build on stable CHK, manifests, and DAG roots but should remain pure before relay/storage orchestration.
**Delivers:** `htree`/`nhash` codecs, tight TLV/bech32 bounds, kind-30064 event templates and deterministic reducer, optional 30078 read compatibility, and all visibility/key-recovery modes.
**Addresses:** Mutable/immutable references, root resolution/publication helpers, public/link-private/owner-private trees.
**Avoids:** Arrival-order roots, malformed tags, incomplete visibility modes, unsupported keyed-`nhash` length, and unverified link-key recovery.

### Phase 6: Storage Adapters and Stateless End-to-End Resolver

**Rationale:** Network integration should consume already-proven protocol values and reuse the SDK's established 401/402 and multi-server behavior.
**Delivers:** Narrow storage ports over existing actions, injected Nostr/NIP-44 ports, fetch-verify-decrypt-decode resolution, cancellation/progress, explicit durability policy, and cross-implementation functional scenarios.
**Addresses:** Callback-injected integration, Blossom fallback/mirroring, functional-first public API, interoperability.
**Avoids:** Duplicate HTTP logic, secrets in requests, trusting server descriptors/responses, implicit partial replication, and relay-library coupling.

### Phase 7: Staged Filesystem and Commit Pipeline

**Rationale:** Stateful mutation is safe only after canonical builders, storage semantics, and root publication helpers are independently reliable.
**Delivers:** Copy-on-write overlay, complete staged filesystem/metadata operations, dirty/change inspection, generation-snapshotted prepare/upload/publish/finalize commit, retry/no-op behavior, and conflict policy.
**Addresses:** Familiar async filesystem surface, explicit commits, immutable-handle capability rules, structural sharing.
**Avoids:** Auto-commit, dangling roots, lost concurrent edits, premature stage clearing, ambiguous multi-server success, and silent last-write-wins.

### Phase 8: Modular Client Lifecycle and Reactive Updates

**Rationale:** Caches, subscriptions, and concurrency are the highest state-complexity layer and should compose stable stateless reads and commits.
**Delivers:** `HashtreeClient`, mutable/immutable `LoadedHashtree` handles, deduplicated load/unload, bounded hash/key caches, revision path indexes, subscribe-first/backfill update mux, divergence events, cancellation, final package/interoperability matrix, and Changeset.
**Addresses:** Dynamic tree lifecycle, isolated caches, local/remote async iterable, clean-tree advance and dirty-tree divergence.
**Avoids:** Snapshot/subscription gaps, stale replay, relay echo duplication, cache contamination, secret retention, unbounded queues, and unload leaks.

### Phase Ordering Rationale

- Phase 1 establishes the public and packaging invariants that every later file must obey.
- Phases 2–5 follow protocol dependency order: CHK and canonical nodes determine identities; BUD-17 composes them into DAGs; BUD-18 names and publishes those roots.
- Phase 6 integrates network boundaries only after byte-level behavior is independently testable.
- Phase 7 adds mutation and distributed commit over stable DAG/storage/root functions; Phase 8 adds lifecycle concurrency last.
- Exact vectors, adversarial fixtures, Node/browser runs, and root-export isolation are continuous gates, not an end-of-project test phase.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2:** Re-check BUD-15 PR head and WebCrypto byte/tag behavior; research a fallback only if WebCrypto cannot be the single supported path.
- **Phase 3:** Run a codec spike before committing to `@msgpack/msgpack`; prove exact minimal integers, bins, ordering, extension rejection, and decoder limits.
- **Phase 4:** Threat-model and choose concrete default traversal/cache/concurrency budgets; cross-check all 2 MiB/174 boundary roots with the reference implementation.
- **Phase 5:** Resolve draft BUD-18 tag cardinality, maximum `nhash` length, signature-verification responsibility, and compatibility precedence against the current PR head.
- **Phase 6:** Decide the default multi-server durability predicate and browser-compatible upload payload conversion; verify existing protected-download callback gaps.
- **Phase 7:** Write a formal state-machine contract for base root, stage generations, durability, publication, retry, and remote conflicts before implementation.
- **Phase 8:** Specify snapshot/subscription handoff, replay/deduplication, queue backpressure, local echo, and unload semantics with a deterministic race harness.

Phases with standard patterns (skip research-phase unless draft state changes):

- **Phase 1:** Package subpath, types/errors, and build smoke tests are established repository patterns.
- **Phase 8 packaging/release slice:** Build, declaration, packed-export, Node matrix, browser suite, and Changeset mechanics are established; only reactive semantics need research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Repository/runtime constraints are high-confidence, but the two new versions require vector and bundle spikes; BUD behavior is draft-derived. |
| Features | MEDIUM | Full BUD scope is explicit and cross-checked with the reference crate; client ergonomics, persistence, and conflict policies are project decisions. |
| Architecture | MEDIUM | Functional-core/stateful-shell and dependency order strongly match the codebase; lifecycle, durability, and upload-shape decisions remain open. |
| Pitfalls | MEDIUM | Protocol hazards are grounded in draft text/vectors and local code audit, but draft evolution and adversarial defaults require revalidation. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Draft stability:** Pin tests and documentation to the cited BUD PR-head commits; re-check all four heads at each relevant phase and immediately before release.
- **MessagePack proof:** Verify the recommended library against every published vector and adversarial ordering/integer/bin case before its adapter becomes foundational.
- **BUD-18 policy details:** Confirm maximum keyed-`nhash` size, root tag cardinality, legacy 30078 precedence, and verification responsibility.
- **Resource defaults:** Choose finite, composable traversal, fetch, cache, upload-concurrency, and update-queue budgets from threat-model tests.
- **Distributed success semantics:** Define conservative default replication and publication acknowledgement policies while allowing a caller predicate.
- **Conflict contract:** Specify clean auto-advance, dirty divergence, rebase/discard/force behavior, and immutable-handle `fork()` semantics.
- **Existing action seam:** Determine whether protected fallback downloads require direct `downloadBlob()` iteration because `resolveBlob()` does not propagate all auth/payment callbacks.
- **Upload portability:** Resolve generated `Uint8Array`/stream conversion against the existing `Blob | File | Buffer` upload contract without introducing Node-only APIs.
- **Interoperability and isolation:** Maintain reference cross-read/cross-write fixtures plus built/packed root-versus-subpath module-graph checks; self-round-trips are insufficient.

## Sources

### Primary (MEDIUM confidence)

- [BUD-15 draft PR #104](https://github.com/hzrd149/blossom/pull/104) — CHK construction, integrity rules, parameters, security notes, and vectors.
- [BUD-16 draft PR #105](https://github.com/hzrd149/blossom/pull/105) — canonical MessagePack, validation, paths, and vectors.
- [BUD-17 draft PR #106](https://github.com/hzrd149/blossom/pull/106) — chunk/fanout constants, canonical construction, traversal, and safety rules.
- [BUD-18 draft PR #107](https://github.com/hzrd149/blossom/pull/107) — references, `nhash`, root events, selection, visibility, and safety rules.
- [Published `hashtree-core` reference crate](https://docs.rs/crate/hashtree-core/latest) — implementation cross-check for codec, CHK, builders, traversal, `nhash`, visibility, and streaming.

### Primary (HIGH confidence for existing project constraints)

- [Project definition](../PROJECT.md) — milestone scope, portability, modular-client requirement, staging, and explicit commit semantics.
- Repository `package.json`, `tsconfig.json`, `src/index.ts`, `src/actions/*.ts`, and `.planning/codebase/` research — current exports, engine/build constraints, HTTP behavior, architecture, and test surfaces.
- [Node.js Web Crypto documentation](https://nodejs.org/api/webcrypto.html) and [Web Streams documentation](https://nodejs.org/api/webstreams.html) — supported runtime APIs.
- [`@msgpack/msgpack` v3.1.3 source/docs](https://github.com/msgpack/msgpack-javascript/tree/v3.1.3) — runtime support, options, numeric/bin behavior, bounds, and `sortKeys` implementation.
- [`@scure/base` v1.2.6 source/docs](https://github.com/paulmillr/scure-base/tree/1.2.6) — bech32 API, default length, compatibility, and packaging.

### Secondary (MEDIUM confidence)

- [Published `git-remote-htree` crate](https://docs.rs/crate/git-remote-htree/latest) — ecosystem evidence for public, link-visible, and private workflows.
- [Node.js `fs/promises` API](https://nodejs.org/api/fs.html#promises-api) — ergonomic vocabulary only, not OS-semantic parity.

---
*Research completed: 2026-08-09*
*Ready for roadmap: yes*
