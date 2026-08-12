# Requirements: blossom-client-sdk Hashtree Support

**Defined:** 2026-08-12
**Core Value:** Applications can create, publish, resolve, mutate, stream, and react to interoperable Blossom Hashtrees without implementing the cryptography, canonical encoding, traversal, storage orchestration, or Nostr root lifecycle themselves.

## v1 Requirements

Requirements for the first Hashtree milestone. Each maps to exactly one roadmap phase.

### Packaging and Contracts

- [x] **PKG-01**: Consumer can import all Hashtree APIs from `blossom-client-sdk/hashtree`
- [x] **PKG-02**: Importing the package root does not export, evaluate, or bundle Hashtree modules or dependencies
- [x] **PKG-03**: Hashtree APIs work in Node.js 18+ and modern browsers without Node-only public types
- [x] **PKG-04**: Consumer receives stable typed errors for validation, integrity, bounds, conflicts, immutable trees, callbacks, and lifecycle failures

### BUD-15 Encryption

- [x] **CHK-01**: Consumer can deterministically encrypt plaintext using the exact `chk-v1` algorithm
- [x] **CHK-02**: Consumer can decrypt only after validating the ciphertext hash, GCM authentication, and plaintext CHK hash
- [x] **CHK-03**: Each encrypted file chunk derives its own key from its own plaintext
- [x] **CHK-04**: Consumer can parse and create `blossom:` references containing valid `enc=chk-v1` and `k` parameters
- [x] **CHK-05**: Hashtree secrets are never forwarded to Blossom servers or exposed through ordinary errors, progress events, or diagnostics
- [x] **CHK-06**: Plaintext and encrypted modes are first-class throughout the functional and client APIs, with plaintext as the client default

### BUD-16 Directories

- [ ] **DIR-01**: Consumer can canonically encode directory manifests with exact BUD field, binary, integer, and UTF-8 byte ordering
- [ ] **DIR-02**: Consumer can strictly decode and validate directory nodes, links, names, metadata, sizes, and supported types
- [ ] **DIR-03**: Consumer can resolve independently percent-decoded path segments without separator or traversal ambiguity
- [ ] **DIR-04**: Consumer can read and update JSON-compatible link metadata while preserving unknown valid keys

### BUD-17 Files and Fanout

- [ ] **DAG-01**: Consumer can build canonical file DAGs using 2 MiB chunks and at most 174 links per node
- [ ] **DAG-02**: Consumer can build canonical flat and fanout directories while hiding internal fanout nodes from listings
- [ ] **DAG-03**: Consumer can resolve files and directories with configurable finite limits on depth, manifests, links, fetched bytes, and plaintext bytes
- [ ] **DAG-04**: Every fetched object is hash-verified before it is decoded, decrypted, cached, or used
- [ ] **DAG-05**: Consumer can read large files as verified ordered streams with backpressure, cancellation, and bounded memory
- [ ] **DAG-06**: Consumer can explicitly assemble a streamed file into a `Blob`

### BUD-18 References and Roots

- [ ] **REF-01**: Consumer can parse and create mutable `htree://<npub>/<tree>/<path>` references
- [ ] **REF-02**: Consumer can parse and create immutable `htree://<nhash>/<path>` references
- [ ] **REF-03**: Consumer can encode and decode keyed and unkeyed `nhash` values, including the specified legacy form
- [ ] **REF-04**: Consumer can resolve the latest valid kind `30064` root deterministically, including same-timestamp event-ID tie-breaking
- [ ] **REF-05**: Consumer can optionally read compatible kind `30078` roots without emitting them
- [ ] **REF-06**: Consumer can construct, sign through a callback, and publish kind `30064` root events
- [ ] **REF-07**: Consumer can create and resolve public mutable roots
- [ ] **REF-08**: Consumer can create and resolve link-private roots with link-key and `keyId` verification
- [ ] **REF-09**: Consumer can create and resolve owner-private roots through injected NIP-44 callbacks

### Storage and Integration

- [ ] **INT-01**: Consumer can fetch and upload Hashtree objects through injected storage functions backed by existing Blossom actions
- [ ] **INT-02**: Consumer can use existing single- and multi-server auth, payment, preflight, mirroring, retry, and cancellation behavior
- [ ] **INT-03**: Consumer supplies Nostr query, publish, subscribe, sign, and NIP-44 functions without installing a relay library required by the SDK
- [ ] **INT-04**: Stateless functional APIs can publish and resolve complete plaintext and encrypted Hashtrees without using client classes
- [ ] **INT-05**: A commit uploads all required chunks and manifests before publishing a root that references them

### Filesystem and Commits

- [ ] **FS-01**: Loaded trees provide portable asynchronous `readFile`, streaming read, `readdir`, and `stat` operations
- [ ] **FS-02**: Loaded trees provide `writeFile`, `mkdir`, and recursive or forced removal with documented filesystem-like conflict behavior
- [ ] **FS-03**: Loaded trees provide rename or move and copy operations for files and directory subtrees
- [ ] **FS-04**: Loaded trees provide metadata read, replace, and merge operations
- [ ] **FS-05**: Mutations remain staged locally, are immediately visible to reads, and cause no network publication before `commit()`
- [ ] **FS-06**: Consumer can inspect dirty state and staged changes
- [ ] **FS-07**: A successful explicit commit advances the tree only after required uploads and root publication succeed
- [ ] **FS-08**: A failed commit preserves staged state for retry and never falsely reports the new root as committed
- [ ] **FS-09**: Immutable tree handles cannot publish mutations and expose that restriction through their types or a dedicated error

### Modular Client and Reactivity

- [ ] **CLI-01**: Consumer can configure one overall client with shared servers, policies, auth and payment hooks, storage functions, and Nostr callbacks
- [ ] **CLI-02**: Consumer can dynamically load and unload independent mutable and immutable tree instances
- [ ] **CLI-03**: Each loaded tree owns isolated root state, bounded caches, staged changes, subscription, and cleanup lifecycle
- [ ] **CLI-04**: A tree exposes an async iterable of ordered loaded, staged, committed, remote-root, divergence, error, and unloaded updates
- [ ] **CLI-05**: A caller-provided remote subscription async iterable is validated, deduplicated, and merged into tree updates
- [ ] **CLI-06**: Remote roots may advance a clean tree under documented policy but never overwrite dirty staged changes
- [ ] **CLI-07**: A dirty tree reports remote divergence and requires an explicit refresh, rebase, discard, or force decision
- [ ] **CLI-08**: Unloading a tree cancels its subscription and releases tree-local caches without affecting other trees

### Verification and Release

- [ ] **TEST-01**: Node and browser suites reproduce every published BUD-15/16/17/18 test vector byte-for-byte
- [ ] **TEST-02**: The SDK cross-reads and cross-writes representative plaintext and encrypted trees with the Hashtree reference implementation
- [ ] **TEST-03**: Adversarial tests reject corrupt crypto, malformed MessagePack, unsafe paths, invalid fanout, unsupported types, exceeded budgets, and subscription or commit races
- [x] **TEST-04**: Packed-package tests prove the Hashtree subpath works while the root entrypoint remains isolated
- [ ] **TEST-05**: Published Hashtree support includes API documentation and a minor Changeset

## v2 Requirements

Deferred until the first Hashtree milestone has validated its protocol and client contracts.

### Performance and Adapters

- **PERF-01**: Consumer can supply a persistent cache adapter after cache keying, invalidation, and secret handling are proven
- **PERF-02**: Consumer can perform fine-grained range reads over file manifests when downstream demand establishes semantics
- **TOOL-01**: Consumer can inspect tree diffs and commit previews through stable staged-operation types
- **ADPT-01**: Consumers can use optional framework or RxJS adapters outside the portable core
- **COMP-01**: Readers can support additional legacy reference-implementation fanout forms without changing canonical writers

### Distributed and Offline Work

- **CONF-01**: Consumer can apply an explicit collaborative merge strategy to divergent roots
- **OFFL-01**: Consumer can persist, migrate, protect, and replay an offline workspace
- **GC-01**: Consumer can plan reachability and garbage collection for obsolete Hashtree objects
- **ADPT-02**: Consumer can use separate gateway or local-filesystem adapters

## Out of Scope

Explicitly excluded from this milestone to prevent scope creep and preserve the SDK's portability and protocol boundaries.

| Feature | Reason |
|---------|--------|
| Automatic commit after each mutation | Removes batching and retry boundaries and conflicts with the explicit-commit design |
| Built-in relay pool or required `nostr-tools` runtime dependency | Couples the SDK to one relay stack and violates callback-injected integration |
| Root-level Hashtree re-exports | Makes unrelated consumers load specialized code and dependencies |
| Buffer-only large-file reads | Does not provide bounded-memory browser and Node operation |
| Full Node `fs` parity | File descriptors, permissions, symlinks, OS paths, synchronous calls, and watchers do not map to portable manifests |
| Sending decryption keys to Blossom servers | Leaks bearer secrets and violates the BUD security model |
| Skipping integrity checks for streams or cache hits | BUD-15 requires both integrity checks and all remote data remains untrusted |
| Configurable canonical chunk size or fanout for normal writes | Produces noncanonical roots and breaks deterministic interoperability |
| Exposing internal fanout nodes through directory listings | Leaks storage structure and violates BUD-17 visible-directory semantics |
| Treating unknown link types as raw blobs | Creates type confusion instead of the required unsupported-type failure |
| Silent remote fast-forward over staged edits | Can destroy local work and make commits nondeterministic |
| Unbounded caches or update queues | Allows dynamic trees or hostile graphs to retain unbounded data and secrets |
| Core filesystem materialization | Introduces Node-only coupling and filesystem traversal risk |
| Collaborative CRDT or merge semantics in v1 | BUD-18 defines mutable replacement, not a standardized merge protocol |

## Traceability

Roadmap creation maps every v1 requirement to exactly one implementation phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKG-01 | Phase 1 | Complete |
| PKG-02 | Phase 1 | Complete |
| PKG-03 | Phase 1 | Complete |
| PKG-04 | Phase 1 | Complete |
| CHK-01 | Phase 2 | Complete |
| CHK-02 | Phase 2 | Complete |
| CHK-03 | Phase 2 | Complete |
| CHK-04 | Phase 2 | Complete |
| CHK-05 | Phase 2 | Complete |
| CHK-06 | Phase 2 | Complete |
| DIR-01 | Phase 3 | Pending |
| DIR-02 | Phase 3 | Pending |
| DIR-03 | Phase 3 | Pending |
| DIR-04 | Phase 3 | Pending |
| DAG-01 | Phase 4 | Pending |
| DAG-02 | Phase 4 | Pending |
| DAG-03 | Phase 4 | Pending |
| DAG-04 | Phase 4 | Pending |
| DAG-05 | Phase 4 | Pending |
| DAG-06 | Phase 4 | Pending |
| REF-01 | Phase 5 | Pending |
| REF-02 | Phase 5 | Pending |
| REF-03 | Phase 5 | Pending |
| REF-04 | Phase 5 | Pending |
| REF-05 | Phase 5 | Pending |
| REF-06 | Phase 5 | Pending |
| REF-07 | Phase 5 | Pending |
| REF-08 | Phase 5 | Pending |
| REF-09 | Phase 5 | Pending |
| INT-01 | Phase 6 | Pending |
| INT-02 | Phase 6 | Pending |
| INT-03 | Phase 6 | Pending |
| INT-04 | Phase 6 | Pending |
| INT-05 | Phase 7 | Pending |
| FS-01 | Phase 7 | Pending |
| FS-02 | Phase 7 | Pending |
| FS-03 | Phase 7 | Pending |
| FS-04 | Phase 7 | Pending |
| FS-05 | Phase 7 | Pending |
| FS-06 | Phase 7 | Pending |
| FS-07 | Phase 7 | Pending |
| FS-08 | Phase 7 | Pending |
| FS-09 | Phase 7 | Pending |
| CLI-01 | Phase 8 | Pending |
| CLI-02 | Phase 8 | Pending |
| CLI-03 | Phase 8 | Pending |
| CLI-04 | Phase 8 | Pending |
| CLI-05 | Phase 8 | Pending |
| CLI-06 | Phase 8 | Pending |
| CLI-07 | Phase 8 | Pending |
| CLI-08 | Phase 8 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 8 | Pending |
| TEST-04 | Phase 1 | Complete |
| TEST-05 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-12*
*Last updated: 2026-08-12 after roadmap creation*
