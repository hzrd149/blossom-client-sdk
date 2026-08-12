# blossom-client-sdk Hashtree Support

## What This Is

`blossom-client-sdk` is a portable TypeScript ESM library for browser and Node.js applications that communicate with Blossom servers. Its first new GSD milestone adds complete client-side support for the draft BUD-15, BUD-16, BUD-17, and BUD-18 Hashtree protocols, providing both reusable functional primitives and an ergonomic modular client API for downstream applications and libraries.

## Core Value

Applications can create, publish, resolve, mutate, stream, and react to interoperable Blossom Hashtrees without implementing the cryptography, canonical encoding, traversal, storage orchestration, or Nostr root lifecycle themselves.

## Requirements

### Validated

- ✓ Consumers can upload, download, list, delete, mirror, resolve, and report Blossom blobs through standalone action functions — existing
- ✓ Consumers can coordinate uploads and media uploads across multiple Blossom servers with auth and Cashu retry support — existing
- ✓ Consumers can inject signing, authentication, payment, server-resolution, and error-handling callbacks without coupling the SDK to a specific application stack — existing
- ✓ The SDK runs as an ESM library in Node.js 18+ and browsers, with browser-specific media helpers isolated behind appropriate entrypoints — existing
- ✓ Public APIs are available through explicit package export paths, including dedicated action and helper subpaths — existing
- ✓ Consumers can import portable Hashtree contracts and stable typed errors from an isolated package subpath without affecting root imports — Phase 1
- ✓ Consumers can use exact BUD-15 CHK encryption/decryption, strict capability references, and secret-safe plaintext/encrypted contracts without weakening root isolation — Phase 2

### Active

- [ ] Implement deterministic BUD-16 MessagePack directory manifest encoding, decoding, validation, and path resolution
- [ ] Implement BUD-17 chunked file manifests and directory fanout using canonical 2 MiB chunks and 174-link limits
- [ ] Implement BUD-18 mutable and immutable Hashtree references, including `htree` URI handling, `nhash`, kind `30064` roots, and all visibility modes
- [ ] Support plaintext and encrypted Hashtrees as first-class modes in both functional and client APIs, with plaintext as the client default
- [ ] Provide streaming large-file reads and a convenience API that assembles a `Blob`
- [ ] Integrate Hashtree storage with existing single- and multi-server Blossom upload/download behavior
- [ ] Keep Nostr querying, publishing, subscriptions, signing, and NIP-44 operations callback-injected and relay-library agnostic
- [ ] Provide standalone functional APIs first, then build a modular overall client with independently loadable and unloadable tree instances
- [ ] Give loaded tree instances root state, decoded-node/blob caches, staged mutations, and explicit commits
- [ ] Provide an asynchronous filesystem-like tree API modeled on Node.js `fs/promises`, including read, write, list, stat, mkdir, remove, rename/move, copy, and metadata operations
- [ ] Expose async-iterable tree updates combining local staged/committed changes with remote root events from a caller-provided async subscription
- [ ] Match the BUD test vectors exactly and round-trip interoperably with the Hashtree reference implementation

### Out of Scope

- Built-in Nostr relay connections or a runtime dependency on `nostr-tools` — applications provide query, publish, subscription, signing, and encryption callbacks
- Blossom server changes — BUD-15 through BUD-18 are client/gateway protocols whose objects are stored as ordinary Blossom blobs
- Node-only filesystem coupling in the core Hashtree API — the export must remain portable across supported browser and Node.js runtimes
- Automatic persistence after every mutation — tree changes remain staged until an explicit commit
- Flattening Hashtree APIs onto the package root export — consumers must opt in through the dedicated subpath

## Context

The existing library is a single-package TypeScript ESM SDK with standalone action functions and callback-injected integrations. Its public root barrel intentionally does not flatten every action, and optional or specialized functionality is exposed through package subpaths.

The new Hashtree work is based on four draft Blossom pull requests:

- BUD-15 defines deterministic client-side CHK encryption using a plaintext SHA-256 key, HKDF-SHA256, AES-256-GCM, and ciphertext addressing.
- BUD-16 defines deterministic MessagePack directory manifests with canonical ordering, named links, metadata, sizes, link types, validation, and path traversal.
- BUD-17 defines large-file chunk manifests and large-directory fanout with 2 MiB chunks, at most 174 links per node, recursive traversal, and strict safety validation.
- BUD-18 defines mutable `htree://<npub>/<tree>/<path>` and immutable `htree://<nhash>/<path>` references, Nostr kind `30064` root events, and public, link-private, and owner-private visibility.

The functional layer is the foundation for applications and downstream libraries. The client layer follows afterward and composes those primitives into an ergonomic API. One overall client owns shared Blossom, auth/payment, Nostr, and policy configuration. Independently loaded tree instances own tree-local roots, caches, staged changes, commits, and update streams so applications can dynamically load and unload trees.

## Constraints

- **Runtime compatibility**: Support Node.js 18+ and modern browsers — this matches the published SDK contract
- **Module isolation**: Hashtree code and dependencies must only load through `blossom-client-sdk/hashtree` — existing consumers should not pay bundle or dependency cost
- **API architecture**: Supply stateless functions and a thin modular client layer — downstream libraries need composable primitives while applications need convenience
- **Nostr integration**: Use caller-provided callbacks and async iterables — the SDK must remain relay-library agnostic
- **Mutation semantics**: Changes are staged and persisted only by explicit commit — callers need predictable batching and publication boundaries
- **Protocol fidelity**: Follow canonical encoding, cryptographic verification, path rules, safety bounds, and official vectors — deterministic hashes and interoperability depend on exact bytes and validation
- **Memory behavior**: Large files must be readable as streams — assembling entire files in memory cannot be the only interface
- **Formatting and verification**: Preserve the repository's TypeScript ESM, Vitest, Prettier, and Changesets conventions — published behavior changes require tests, build verification, and a changeset

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Isolate Hashtree support behind `blossom-client-sdk/hashtree` | Keep specialized implementation and dependencies out of the root bundle | ✓ Validated in Phase 1 with namespace, evaluation, emitted-graph, and packed-package checks |
| Publish `hashtree/types` and `hashtree/errors` as permanent focused module imports | Support both a curated flat barrel and stable direct contract imports | ✓ Confirmed in Phase 1; removal or rename requires compatibility handling |
| Use class identity and narrowly copied safe fields for Hashtree failures | Preserve useful causes and diagnostics without generic secret-bearing context or speculative error codes | ✓ Validated in Phase 1 |
| Derive deterministic CHK encryption from plaintext SHA-256 keys and verify ciphertext address, GCM authentication, and plaintext commitment | Match BUD-15 exactly while presenting one cause-free integrity failure shape | ✓ Validated in Phase 2 with official vectors and adversarial Node/browser coverage |
| Preserve unknown Blossom reference extensions as ordered pairs while canonicalizing recognized fields | Keep capability references strict, lossless, and interoperable | ✓ Validated in Phase 2 |
| Treat encrypted references and complete encrypted URIs as bearer capabilities | Prevent keys from leaking through ordinary errors, progress events, diagnostics, or root imports | ✓ Validated in Phase 2 |
| Build functional primitives before the client layer | Establish a reusable base for applications and downstream libraries | — Pending |
| Offer standalone functions and modular client classes | Serve low-level composition and ergonomic application use without duplicating protocol logic | — Pending |
| Use one overall client and independently loadable tree instances | Centralize shared configuration while allowing dynamic tree lifecycles and tree-local state | — Pending |
| Retain caches and staged mutations on loaded tree instances | Support efficient filesystem-like interactions and explicit transactional commits | — Pending |
| Model tree operations after async Node.js `fs/promises` | Give developers a familiar filesystem mental model while remaining cross-runtime | — Pending |
| Support plaintext and encrypted trees throughout, defaulting clients to plaintext | Both modes are valid in the draft specs and should be first-class | — Pending |
| Implement every BUD-18 visibility mode | Full protocol support includes public, link-private, and owner-private mutable roots | — Pending |
| Keep all Nostr and NIP-44 transport/crypto integration callback-injected | Preserve the SDK's dependency-injection architecture and avoid relay-library coupling | — Pending |
| Require explicit commits | Allow changes to be staged, batched, reviewed, and published at a clear boundary | — Pending |
| Merge local and remote changes into async-iterable update streams | Enable reactive UI applications without imposing a UI framework | — Pending |
| Verify against BUD vectors and the Hashtree reference implementation | Exact canonical bytes and cross-implementation behavior define interoperability | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-12 after Phase 2*
