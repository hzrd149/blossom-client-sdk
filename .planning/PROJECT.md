# Blossom Client SDK Hashtree Support

## What This Is

This project adds experimental end-to-end client SDK support for the BUD-15 through BUD-18 hashtree proposal chain in `blossom-client-sdk`. The SDK should let consumers encrypt Blossom blobs with CHK, build and upload deterministic hashtree manifests, resolve `htree://` references, and download/decrypt files or directories using the existing Blossom server action layer.

The work is for SDK consumers building clients, gateways, and tools that want filesystem-like content trees on top of Blossom blobs without requiring Blossom servers to implement new endpoints.

## Core Value

Consumers can round-trip hashtree content through Blossom servers using a clear experimental SDK API that follows the current BUD-15 to BUD-18 specifications.

## Requirements

### Validated

- ✓ Upload, download, mirror, delete, list, media, report, and multi-server Blossom HTTP actions exist in `src/actions/*.ts` — existing
- ✓ Nostr kind `24242` auth, server list parsing, and reusable auth-event handling exist in `src/auth.ts` and `src/nostr.ts` — existing
- ✓ `blossom:` URI parsing and resolution helpers exist in `src/helpers/blossom-uri.ts` and `src/actions/resolve.ts` — existing
- ✓ Node and browser-compatible TypeScript ESM library structure exists with Vitest node/browser test coverage — existing

### Active

- [ ] Add experimental BUD-15 CHK encryption and decryption support for client-side encrypted Blossom blobs.
- [ ] Add deterministic BUD-16 MessagePack directory manifest encode/decode support with test-vector coverage.
- [ ] Add BUD-17 chunked file and directory fanout manifest creation and traversal support.
- [ ] Add BUD-18 `htree://` reference parsing, building, and resolution support for immutable `nhash` references and mutable `npub/tree/path` references.
- [ ] Provide end-to-end upload and download APIs that compose encryption, chunking, manifest creation, Blossom upload/download, and reference resolution.
- [ ] Support all BUD-18 mutable root visibility modes in the initial API: public, link-private, and owner-private.
- [ ] Expose the hashtree APIs as experimental while the upstream BUD PRs remain open.

### Out of Scope

- Server-side Blossom endpoint changes — BUD-15 through BUD-18 are client-side conventions and Blossom servers store normal blobs.
- Stable API guarantees for hashtree exports before the upstream BUD PRs merge — APIs should be clearly marked experimental.
- Building a full sync client, filesystem watcher, UI, gateway server, relay integration, or persistent local database in this milestone.
- Replacing existing `blossom:` URI behavior — `htree://` support should be additive.

## Context

- Existing SDK architecture is a TypeScript ESM library with functional action modules in `src/actions/`, pure helpers in `src/helpers/`, public barrels in `src/index.ts`, and subpath exports in `package.json`.
- Existing HTTP behavior is already Blossom-protocol oriented: `uploadBlob`, `downloadBlob`, `mirrorBlob`, `hasBlob`, `multiServerUpload`, and `resolveBlob` can be composed by higher-level hashtree APIs.
- BUD-15 PR #104 defines `chk-v1` client-side Content Hash Key encrypted blobs using `chk_key = SHA256(plaintext)`, HKDF-SHA256, AES-256-GCM, deterministic encryption, ciphertext Blossom hashes, and `enc=chk-v1` plus `k=<chk_key>` URI parameters.
- BUD-16 PR #105 defines deterministic MessagePack directory manifests with named links, hashes, optional child keys, metadata, sizes, link types, `.bdir` URI guidance, path resolution rules, safety limits, and test vectors.
- BUD-17 PR #106 defines chunked file manifests (`t = 1`) and directory fanout nodes (`t = 2`), canonical 2 MiB chunks, maximum 174 links per node, recursive traversal, `_chunk_<start>` fanout, encrypted child keys, URI extensions, safety limits, and test vectors.
- BUD-18 PR #107 defines `htree://` references, including mutable `htree://<npub>/<tree-name>/<path>` references, immutable `htree://<nhash>/<path>` references, public/link-private/owner-private mutable root visibility scopes, `nhash` bech32 TLV encoding, and test vectors.
- The user wants v1 to include end-to-end APIs, not only protocol primitives.
- The user prefers an optional crypto-library approach if native Web Crypto compatibility becomes awkward.

## Constraints

- **Runtime compatibility**: Preserve Node >=18 and browser compatibility declared by `package.json` and `tsconfig.json`.
- **API stability**: Mark hashtree exports experimental until BUD-15 through BUD-18 are merged upstream.
- **Architecture**: Follow existing SDK patterns: standalone async functions, small helper modules, callback-injected integrations, public subpath exports, and no class-heavy design unless required by external adapters.
- **Dependencies**: Keep new dependencies minimal and justified; optional crypto dependencies are acceptable if they materially reduce risk or improve cross-runtime correctness.
- **Testing**: Add test-vector and round-trip coverage under `tests/`, using real hashing/crypto where possible and existing fetch mocks for HTTP behavior.
- **Protocol source**: Treat GitHub PRs #104, #105, #106, and #107 in `hzrd149/blossom` as the current spec source for planning.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build an end-to-end API in v1 | The user explicitly wants upload/download hashtree support, not just low-level primitives. | — Pending |
| Support all BUD-18 mutable visibility modes initially | Public, link-private, and owner-private are part of the proposed BUD-18 model. | — Pending |
| Allow an optional crypto-library approach | CHK requires HKDF-SHA256 and AES-256-GCM across Node and browsers; an optional dependency may reduce implementation risk. | — Pending |
| Mark hashtree APIs experimental | Upstream BUD PRs are still open and may change. | — Pending |
| Keep server behavior unchanged | The BUD chain is client-side; servers store normal Blossom blobs. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-25 after initialization*
