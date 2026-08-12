# Roadmap: blossom-client-sdk Hashtree Support

## Overview

This milestone establishes an isolated Hashtree package boundary, then delivers the BUD protocols in dependency order from exact cryptography and canonical manifests through bounded DAGs and root references. Those functional primitives are integrated with Blossom and caller-provided Nostr ports before stateful filesystem commits and modular reactive clients are layered on top. Each boundary is independently observable and verifiable so security-critical byte, integrity, publication, and lifecycle behavior is proven before higher-level state depends on it.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Packaging Boundary and Protocol Contracts** - Consumers can opt into portable typed Hashtree APIs without affecting root imports.
- [ ] **Phase 2: BUD-15 CHK and Secret-Safe References** - Consumers can use exact deterministic CHK encryption safely in plaintext or encrypted workflows.
- [ ] **Phase 3: BUD-16 Canonical Directories** - Consumers can encode, validate, traverse, and update canonical directory manifests.
- [ ] **Phase 4: BUD-17 Bounded DAGs and Streaming** - Consumers can build and read canonical large files and directories within finite resource bounds.
- [ ] **Phase 5: BUD-18 References, Roots, and Visibility** - Consumers can identify and resolve immutable or mutable trees in every specified visibility mode.
- [ ] **Phase 6: Storage Integration and Functional Workflows** - Consumers can publish and resolve complete interoperable trees through standalone functions and injected adapters.
- [ ] **Phase 7: Staged Filesystem and Commit Safety** - Consumers can edit trees through a filesystem-like API and commit them atomically and retryably.
- [ ] **Phase 8: Modular Client Lifecycle and Reactivity** - Consumers can manage independent reactive tree handles through one shared client and ship the supported package.

## Phase Details

### Phase 1: Packaging Boundary and Protocol Contracts

**Goal**: Consumers can opt into stable, portable Hashtree contracts while existing root-import consumers remain completely isolated from Hashtree code and dependencies.
**Depends on**: Nothing (first phase)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, TEST-04
**Success Criteria** (what must be TRUE):

  1. Consumer can import the built and packed `blossom-client-sdk/hashtree` subpath in Node.js 18+ and a browser without Node-only public types.
  2. Consumer importing the package root sees no Hashtree exports, evaluation, or bundled Hashtree dependencies.
  3. Consumer receives stable typed failures for validation, integrity, bounds, conflict, immutable-tree, callback, and lifecycle errors.
  4. Packed-package checks demonstrate that the subpath resolves while the root module graph remains isolated.

**Plans**: 1/2 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Publish the portable Hashtree contract and stable typed-error tracer slice.

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Prove root isolation and packed-package resolution, then record the release change.

### Phase 2: BUD-15 CHK and Secret-Safe References

**Goal**: Consumers can protect Hashtree content with exact BUD-15 behavior without leaking capabilities or weakening integrity verification.
**Depends on**: Phase 1
**Requirements**: CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06
**Success Criteria** (what must be TRUE):

  1. Consumer can deterministically encrypt and decrypt BUD-15 content, and decryption rejects any ciphertext-address, GCM, or plaintext-CHK integrity failure.
  2. Encrypted file chunks use independently derived plaintext keys and valid `blossom:` references round-trip with `enc=chk-v1` and `k` parameters.
  3. Consumer can select plaintext or encrypted functional behavior, with client-facing contracts defaulting to plaintext.
  4. Blossom requests, ordinary errors, progress events, and diagnostics never reveal Hashtree secrets.

**Plans**: TBD

### Phase 3: BUD-16 Canonical Directories

**Goal**: Consumers can exchange deterministic, strictly validated directory manifests and resolve paths without encoding or traversal ambiguity.
**Depends on**: Phase 2
**Requirements**: DIR-01, DIR-02, DIR-03, DIR-04
**Success Criteria** (what must be TRUE):

  1. Consumer can encode a directory to the exact canonical BUD-16 bytes and decode only valid fields, binaries, integers, names, sizes, metadata, and link types.
  2. Consumer can resolve independently percent-decoded path segments while separator injection and traversal ambiguity are rejected.
  3. Consumer can read, replace, and merge JSON-compatible link metadata while unknown valid keys survive round trips.
  4. Malformed, duplicate, unsupported, or noncanonical directory input produces stable typed errors before use.

**Plans**: TBD

### Phase 4: BUD-17 Bounded DAGs and Streaming

**Goal**: Consumers can construct and safely read canonical large-file and large-directory DAGs without unbounded memory or traversal exposure.
**Depends on**: Phase 3
**Requirements**: DAG-01, DAG-02, DAG-03, DAG-04, DAG-05, DAG-06
**Success Criteria** (what must be TRUE):

  1. Consumer can build deterministic file DAGs with canonical 2 MiB chunks and directory/file nodes with no more than 174 links.
  2. Consumer listings show logical directory entries while internal recursive fanout nodes remain hidden.
  3. Every fetched object is hash-verified before decode, decryption, caching, or use, and hostile graphs stop at configurable finite budgets.
  4. Consumer can read verified file bytes in order with backpressure, cancellation, and bounded memory, or explicitly collect them into a `Blob`.

**Plans**: TBD

### Phase 5: BUD-18 References, Roots, and Visibility

**Goal**: Consumers can address and deterministically select interoperable immutable and mutable roots across all BUD-18 visibility modes.
**Depends on**: Phase 4
**Requirements**: REF-01, REF-02, REF-03, REF-04, REF-05, REF-06, REF-07, REF-08, REF-09, TEST-01
**Success Criteria** (what must be TRUE):

  1. Consumer can round-trip mutable and immutable `htree` URIs plus keyed, unkeyed, and specified legacy `nhash` values.
  2. Consumer deterministically selects the latest valid kind `30064` root, including event-ID tie-breaking, and may read compatible kind `30078` roots without emitting them.
  3. Consumer can construct a kind `30064` root, sign and publish it through callbacks, and create or resolve public, link-private, and owner-private roots.
  4. Node and browser suites reproduce every published BUD-15, BUD-16, BUD-17, and BUD-18 vector byte-for-byte.

**Plans**: TBD

### Phase 6: Storage Integration and Functional Workflows

**Goal**: Consumers can publish and resolve complete plaintext or encrypted Hashtrees using standalone APIs and their chosen Blossom and Nostr infrastructure.
**Depends on**: Phase 5
**Requirements**: INT-01, INT-02, INT-03, INT-04, TEST-02
**Success Criteria** (what must be TRUE):

  1. Consumer can fetch and upload verified Hashtree objects through injected storage functions backed by existing single- or multi-server Blossom actions.
  2. Existing auth, payment, preflight, mirroring, retry, and cancellation behavior remains available without exposing keys to servers.
  3. Consumer can inject query, publish, subscribe, sign, and NIP-44 callbacks without installing an SDK-mandated relay library.
  4. Standalone functions cross-read and cross-write representative plaintext and encrypted trees with the reference implementation without client classes.

**Plans**: TBD

### Phase 7: Staged Filesystem and Commit Safety

**Goal**: Consumers can inspect and mutate a tree locally through familiar asynchronous operations, then publish an all-or-nothing root transition explicitly.
**Depends on**: Phase 6
**Requirements**: INT-05, FS-01, FS-02, FS-03, FS-04, FS-05, FS-06, FS-07, FS-08, FS-09
**Success Criteria** (what must be TRUE):

  1. Loaded trees support portable asynchronous reads, streaming, listings, stats, writes, directories, removals, moves, copies, and metadata operations with documented conflict behavior.
  2. Staged mutations are immediately visible to local reads and inspection but cause no upload or root publication before `commit()`.
  3. A successful commit uploads every required chunk and manifest before publishing and advancing the root.
  4. A failed commit preserves staged state for retry and never reports an unpublished root as committed.
  5. Immutable handles cannot publish mutations and communicate that restriction through types or a dedicated error.

**Plans**: TBD

### Phase 8: Modular Client Lifecycle and Reactivity

**Goal**: Consumers can manage multiple isolated, bounded, reactive tree lifecycles through one client and depend on a documented release proven against hostile inputs.
**Depends on**: Phase 7
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, TEST-03, TEST-05
**Success Criteria** (what must be TRUE):

  1. Consumer can configure one client and independently load or unload mutable and immutable tree handles with isolated roots, caches, stages, subscriptions, and cleanup.
  2. Each tree exposes ordered async updates for load, stage, commit, remote root, divergence, error, and unload while validating and deduplicating caller-provided subscriptions.
  3. Clean trees follow documented remote-advance policy, while dirty trees preserve staged work and require an explicit divergence decision.
  4. Unloading cancels the selected tree's work and releases its bounded local state without disturbing any other tree.
  5. Adversarial crypto, codec, path, fanout, budget, subscription, and commit-race suites pass, and published support includes API documentation and a minor Changeset.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Packaging Boundary and Protocol Contracts | 1/2 | In Progress|  |
| 2. BUD-15 CHK and Secret-Safe References | 0/TBD | Not started | - |
| 3. BUD-16 Canonical Directories | 0/TBD | Not started | - |
| 4. BUD-17 Bounded DAGs and Streaming | 0/TBD | Not started | - |
| 5. BUD-18 References, Roots, and Visibility | 0/TBD | Not started | - |
| 6. Storage Integration and Functional Workflows | 0/TBD | Not started | - |
| 7. Staged Filesystem and Commit Safety | 0/TBD | Not started | - |
| 8. Modular Client Lifecycle and Reactivity | 0/TBD | Not started | - |
