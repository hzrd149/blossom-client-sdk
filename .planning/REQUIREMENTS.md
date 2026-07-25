# Requirements: Blossom Client SDK Hashtree Support

**Defined:** 2026-07-25
**Core Value:** Consumers can round-trip hashtree content through Blossom servers using a clear experimental SDK API that follows the current BUD-15 to BUD-18 specifications.

## v1 Requirements

Requirements for the initial hashtree milestone. Each maps to roadmap phases.

### Protocol Primitives

- [ ] **PROTO-01**: SDK provides BUD-15 CHK encryption and decryption helpers that derive `chk_key = SHA256(plaintext)`, use HKDF-SHA256 and AES-256-GCM, and verify both ciphertext hash and plaintext hash commitments.
- [ ] **PROTO-02**: CHK implementation prevents unsafe arbitrary-key zero-nonce encryption and derives independent keys for each blob, chunk, or manifest plaintext.
- [ ] **PROTO-03**: SDK provides helpers for BUD-15 encrypted Blossom URI metadata, including `enc=chk-v1` and `k=<chk_key>`, without sending key material to Blossom servers.
- [ ] **PROTO-04**: SDK provides deterministic BUD-16/BUD-17 MessagePack tree node encode/decode with canonical field order, canonical sorting, bin/string correctness, and malformed-node rejection.
- [ ] **PROTO-05**: SDK provides BUD-18 `nhash` bech32 TLV encode/decode with root hash, optional root key, legacy payload handling if current draft still requires it, and exact test-vector coverage.
- [ ] **PROTO-06**: SDK provides BUD-18 `htree://` parsing/building for immutable `htree://<nhash>/<path>` references and mutable `htree://<npub>/<tree-name>/<path>` references.

### Tree Construction And Traversal

- [ ] **TREE-01**: SDK can create and validate deterministic directory manifests from typed entries, rejecting duplicate names, unsafe path segments, unsupported link types, and invalid metadata.
- [ ] **TREE-02**: SDK can chunk files according to the current BUD-17 constants, including 2 MiB chunks and max 174 links per node unless the upstream draft changes before implementation.
- [ ] **TREE-03**: SDK can create and traverse chunked file manifests, decrypt per-chunk content when keys are present, validate chunk ordering, and reassemble files.
- [ ] **TREE-04**: SDK can create and traverse large directory fanout nodes using the current BUD-17 structural fanout form after reconciling the PR #106 `t` value and metadata semantics.
- [ ] **TREE-05**: SDK enforces traversal safety limits for manifest bytes, link count, recursion depth, visited nodes, total fetched bytes, total plaintext bytes, and concurrent downloads.

### End-To-End Actions

- [ ] **E2E-01**: SDK provides an upload-planning API that creates a hashtree DAG/upload plan without network I/O and reports root hash, optional root key, manifest/chunk counts, and total bytes.
- [ ] **E2E-02**: SDK provides `uploadHashtree` or equivalent single-server action that composes existing Blossom upload behavior, auth callbacks, payment callbacks, timeouts, abort signals, and progress callbacks.
- [ ] **E2E-03**: SDK provides `multiServerUploadHashtree` or equivalent multi-server action that reuses existing multi-server upload/mirroring behavior for chunks and manifests.
- [ ] **E2E-04**: SDK provides immutable reference resolution and download APIs that parse `htree://<nhash>/<path>`, fetch required manifests/blobs from caller-approved servers, validate hashes, decrypt locally, and return typed file or directory results.
- [ ] **E2E-05**: SDK provides directory listing/path lookup APIs that can inspect manifests without recursively downloading every file unless explicitly requested.
- [ ] **E2E-06**: Hashtree network actions never require Blossom server endpoint changes and continue to store chunks and manifests as ordinary Blossom blobs.

### Mutable Roots And Visibility

- [ ] **ROOT-01**: SDK provides kind `30064` mutable root event template helpers for BUD-18 tree roots, including `d=<tree-name>` and root hash/key metadata according to the current draft.
- [ ] **ROOT-02**: SDK resolves mutable roots through caller-provided Nostr callbacks instead of bundling a relay client, selecting the latest valid replaceable root event by pubkey, kind, and tree name.
- [ ] **ROOT-03**: SDK supports BUD-18 public mutable roots.
- [ ] **ROOT-04**: SDK supports BUD-18 link-private mutable roots without leaking link keys to servers or relay lookups.
- [ ] **ROOT-05**: SDK supports BUD-18 owner-private mutable roots through caller-injected NIP-44 encryption/decryption callbacks.
- [ ] **ROOT-06**: SDK isolates optional legacy read compatibility for draft root kinds or fanout shapes and writes only the current BUD draft format.

### Public API, Docs, And Release Hygiene

- [ ] **API-01**: Hashtree APIs are exposed as experimental through a coherent public import surface, including a `./hashtree` subpath and namespace export from `src/index.ts` without flattening every symbol onto the root export.
- [ ] **API-02**: Public TypeScript types document hashtree inputs, upload plans, upload results, references, resolved entries, visibility modes, limits, and callback contracts.
- [ ] **API-03**: Documentation and TypeDoc comments clearly state that BUD-15 through BUD-18 support is experimental while upstream PRs #104 through #107 are open.
- [ ] **API-04**: Package exports, action barrels, helper barrels, build output, and declaration files compile cleanly with `pnpm build`.
- [ ] **API-05**: A Changeset documents the published experimental feature and any new dependencies.

### Verification

- [ ] **TEST-01**: BUD-15 through BUD-18 official or draft test vectors are covered in Vitest, including negative tests for corrupted ciphertext, wrong keys, malformed MessagePack, invalid `nhash`, and unsafe paths.
- [ ] **TEST-02**: Pure hashtree helper tests run without fetch mocks and verify exact bytes/hashes for protocol primitives.
- [ ] **TEST-03**: Hashtree action tests use existing fetch mocks and mock Blossom servers to cover upload, multi-server upload, download, auth retry, payment retry where applicable, abort/timeout propagation, and server-policy rejection.
- [ ] **TEST-04**: Node test suite passes with `pnpm test`, and build passes with `pnpm build`.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Integrations

- **V2-INT-01**: Built-in relay client or relay pool integration for mutable root lookup/publish.
- **V2-INT-02**: Persistent cache/database for manifests, chunks, roots, and partial downloads.
- **V2-INT-03**: Filesystem materialization or sync-client APIs.
- **V2-INT-04**: Gateway HTTP server for resolving `htree://` references over normal HTTP.
- **V2-INT-05**: Stable non-experimental API once upstream BUDs merge and downstream interoperability is proven.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Blossom server endpoint changes | BUD-15 through BUD-18 are client-side conventions; servers store ordinary blobs. |
| Bundled relay client | Existing SDK delegates Nostr networking; mutable roots should use callbacks. |
| Persistent local database | Useful later, but not required for protocol-correct end-to-end SDK support. |
| Full filesystem writer/sync client | Environment-specific and risky; callers should decide how to persist returned files. |
| Stable API guarantee | Upstream BUD PRs are open drafts and may change. |
| Arbitrary-key zero-nonce encryption | Unsafe and contrary to BUD-15 CHK semantics. |
| Sending keys to Blossom servers | Keys are local bearer secrets and not needed for blob storage. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROTO-01 | Phase 1 | Pending |
| PROTO-02 | Phase 1 | Pending |
| PROTO-03 | Phase 1 | Pending |
| PROTO-04 | Phase 1 | Pending |
| PROTO-05 | Phase 1 | Pending |
| PROTO-06 | Phase 1 | Pending |
| TREE-01 | Phase 2 | Pending |
| TREE-02 | Phase 2 | Pending |
| TREE-03 | Phase 2 | Pending |
| TREE-04 | Phase 2 | Pending |
| TREE-05 | Phase 2 | Pending |
| E2E-01 | Phase 3 | Pending |
| E2E-02 | Phase 3 | Pending |
| E2E-03 | Phase 3 | Pending |
| E2E-04 | Phase 3 | Pending |
| E2E-05 | Phase 3 | Pending |
| E2E-06 | Phase 3 | Pending |
| ROOT-01 | Phase 4 | Pending |
| ROOT-02 | Phase 4 | Pending |
| ROOT-03 | Phase 4 | Pending |
| ROOT-04 | Phase 4 | Pending |
| ROOT-05 | Phase 4 | Pending |
| ROOT-06 | Phase 4 | Pending |
| API-01 | Phase 5 | Pending |
| API-02 | Phase 5 | Pending |
| API-03 | Phase 5 | Pending |
| API-04 | Phase 5 | Pending |
| API-05 | Phase 5 | Pending |
| TEST-01 | Phases 1-4 | Pending |
| TEST-02 | Phases 1-2 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-07-25 after initial definition*
