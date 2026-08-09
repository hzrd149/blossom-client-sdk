# Feature Research

**Domain:** Portable TypeScript SDK for BUD-15/16/17/18 Hashtrees over Blossom and Nostr
**Researched:** 2026-08-09
**Confidence:** MEDIUM — protocol behavior comes from the primary draft PRs and published reference crate; the ergonomic client layer is a project design, not a standardized API

## Feature Landscape

The feature surface has two deliberately separate tiers:

1. **Functional foundation:** stateless, byte-accurate protocol primitives and storage/traversal functions. This tier defines interoperability and is useful independently to other libraries.
2. **Client convenience layer:** a modular client and stateful loaded-tree handles that compose those primitives into familiar filesystem operations, staging, commits, lifecycle management, callbacks, and reactive updates.

The foundation must ship first. A client that hides incomplete validation or non-canonical encoding would be ergonomic but non-interoperable.

### Table Stakes — Functional Foundation (Users Expect These)

| Feature | Why Expected | Complexity | Concrete/Testable Behavior |
|---------|--------------|------------|----------------------------|
| Dedicated `blossom-client-sdk/hashtree` entrypoint | Hashtree is optional, specialized functionality; existing root consumers must not load it | MEDIUM | Subpath imports expose all Hashtree APIs; importing the package root neither re-exports nor evaluates Hashtree modules/dependencies |
| BUD-15 CHK encrypt/decrypt | Encryption is the basis of encrypted nodes, chunks, immutable secret links, and private mutable roots | HIGH | Derive `chk_key = SHA256(plaintext)`; HKDF-SHA256 with the exact salt/info; AES-256-GCM with 12 zero bytes; append 16-byte tag; address by SHA-256 of ciphertext; reject wrong blob hash, bad GCM tag, or plaintext/key mismatch; match empty and `hello` vectors |
| Per-chunk encrypted storage | Reusing one key with the fixed nonce across different plaintext is cryptographically unsafe | HIGH | Every chunk independently derives its key from its own plaintext; no API permits an arbitrary reusable CHK AES key; keys never enter Blossom request URLs or headers |
| BUD-15 `blossom:` encryption parameters | Portable links need to carry the algorithm and local bearer key | MEDIUM | Parse/build `enc=chk-v1` and lowercase 64-hex `k`; reject `k` without `enc=chk-v1`; preserve plaintext-oriented extension; never forward `k` to servers |
| Canonical BUD-16 MessagePack codec | Manifest hashes are determined by exact encoded bytes | HIGH | Encode root fields `l,t`; link fields `h,k,m,n,s,t`; omit absent optionals; binary hash/key values; shortest integer forms; UTF-8 byte sort for directory names and metadata keys; decode then validate node/link shape; match official vectors |
| Strict link, node, name, and metadata validation | Untrusted manifests can create ambiguous paths, unsafe materialization, or type confusion | HIGH | Reject unknown types, invalid hash/key lengths, malformed metadata, empty/`.`/`..`/slash/NUL names, duplicate names, named file links, named fanout links, invalid fanout child types, and invalid bounds; ignore unknown valid metadata keys |
| Typed path traversal | The point of a Hashtree is resolving paths, not merely decoding manifests | HIGH | Split path before percent-decoding segments; exact-name traversal through `t=2`; flatten `t=3`; follow `t=1` in manifest order; return raw `t=0`; empty path resolves root; reject invalid percent encoding and unsupported types |
| BUD-17 canonical file construction | Files larger than one blob must produce interoperable roots | HIGH | Use 2,097,152-byte plaintext chunks and at most 174 links per node; omit a manifest for an eligible single blob; recursively group ordered links; parent `s` equals descendant plaintext bytes; deterministic root for identical bytes/mode |
| BUD-17 directory fanout construction | Large directories must scale without exposing implementation nodes | HIGH | Sort visible entries by UTF-8 bytes; use flat `t=2` up to 174 entries; build unnamed `t=3` fanout levels beyond that; supply valid `count`, `first`, `last`, and size metadata; never expose internal links in listing |
| Resource and integrity limits | Resolution operates on attacker-controlled graphs and remote bytes | HIGH | Configurable/default bounds for blob/manifest size, recursion depth, manifest count, link count, total plaintext size, and fetched bytes; verify every fetched object against its link hash before decode/decrypt/use; detect cycles/repeated-work abuse |
| BUD-18 `htree` URI parsing/building | Both mutable names and immutable snapshots are first-class identifiers | HIGH | Round-trip `htree://<npub>/<tree>/<path>` and `htree://<nhash>/<path>`; independently encode segments; exclude query/fragment from path; parse optional link key without leaking it; distinguish mutable from immutable references |
| `nhash` codec | Immutable snapshots and encrypted permalinks require standard identifiers | MEDIUM | Bech32 HRP `nhash`; TLV type 0 hash required and type 5 key optional; accept legacy exact 32-byte payload; reject malformed/duplicate required values and unsupported malformed payloads; match official vector |
| Mutable root resolution | Mutable references depend on deterministic Nostr event selection | HIGH | Ask a callback for valid kind `30064` events by author and `d`; optionally read compatible kind `30078`; require valid lowercase `hash`; choose latest `created_at`, breaking ties by greatest event id; accept only file/directory roots |
| Mutable root event construction | Mutation is useful only if a new root can be published | HIGH | Build kind `30064` template with `d`, `hash`, optional `l=hashtree`, and visibility tags; delegate signing/publication; do not couple to a relay implementation |
| All three BUD-18 visibility modes | Partial visibility support is partial protocol support | HIGH | Public: no key or plaintext `key`; link-private: random 32-byte link key, XOR-wrapped root key, `keyId` verification, optional owner recovery tags; owner-private: NIP-44 `selfEncryptedKey`; resolve failures are explicit and secrets stay local |
| Plaintext and encrypted modes throughout | Both are protocol-valid; users should not need a parallel API family | HIGH | Identical builders, traversal, storage, and client operations accept a mode/policy; plaintext is client default; encrypted mode encrypts chunks and manifests and threads child/root keys correctly |
| Callback-injected storage and Nostr integration | The SDK is browser/Node portable and relay-library agnostic | HIGH | Callbacks cover blob fetch/upload (including existing single/multi-server flows), query latest root, subscribe to roots, publish signed root, sign event, NIP-44 encrypt/decrypt, auth/payment/error/progress; callback errors and aborts propagate predictably |
| Streaming file reads plus `Blob` convenience | Large files cannot require whole-file buffering, while browser consumers still need a simple result | HIGH | Primary read returns ordered byte chunks or `ReadableStream<Uint8Array>` with backpressure and cancellation; each chunk is hash-verified/decrypted before emission; convenience `readFile`/`readBlob` assembles a `Blob` and clearly incurs memory cost |
| Interoperability fixtures | Correctness is exact bytes, not merely successful internal round trips | HIGH | Run official vectors for all four BUDs and cross-read/cross-write representative plaintext/encrypted files, nested directories, fanout trees, URIs, roots, and visibility modes with the reference implementation |

### Table Stakes — Client Convenience Layer (Users Expect These)

| Feature | Why Expected | Complexity | Concrete/Testable Behavior |
|---------|--------------|------------|----------------------------|
| One configured overall client | Shared servers, retry policy, auth/payment, and Nostr callbacks should not be repeated per tree | MEDIUM | Constructor/factory validates shared callbacks and defaults once; it does not open relay connections itself |
| Dynamic tree loading and unloading | Applications may browse multiple trees without permanent state or global singletons | HIGH | Load mutable URI/name or immutable `nhash`; deduplicate concurrently loaded identity; return independent tree handles; unload releases subscriptions and tree-local caches; one tree failure does not poison others |
| Loaded-tree root state and caches | Repeated filesystem operations would otherwise refetch and decode the same immutable graph | HIGH | Handle tracks resolved base root, working root, committed root/event, decoded-node cache, and blob cache; cache entries are keyed by content hash plus key/mode where necessary; callers can clear or bound caches |
| Explicit staged mutations | The project explicitly requires batching rather than network writes after every filesystem call | HIGH | `writeFile`, `mkdir`, `rm`, `rename`, `copy`, and metadata changes update only the working tree; reads immediately observe staged state; dirty status/change summary is inspectable; no root event is published before `commit()` |
| Explicit atomic commit boundary | Users need a predictable publication point and recoverable failures | HIGH | Commit builds canonical changed nodes bottom-up, uploads required blobs, constructs/signs/publishes one new root event, then advances committed state; failure leaves staged changes retryable and does not claim success; no-op commit is defined |
| Async `fs/promises`-like reads | Familiar method names reduce integration friction | MEDIUM | `readFile`/stream, `readdir`, `stat`/`lstat`-like typed metadata, `exists` or well-typed not-found behavior; path semantics are documented and portable, not tied to OS paths |
| Async `fs/promises`-like writes | A usable tree needs complete CRUD rather than low-level link editing | HIGH | `writeFile`, `mkdir` with recursive option, `rm` with recursive/force options, rename/move, copy, and metadata update; precise overwrite/type-conflict/not-found/non-empty-directory behavior |
| Metadata operations | BUD-16 link metadata is part of the persisted model | MEDIUM | Read and replace/merge JSON-compatible link metadata without changing file bytes; canonical key ordering on commit; unknown keys round-trip |
| Mutable versus immutable handle capabilities | An immutable snapshot must not misleadingly appear publishable | MEDIUM | Immutable handles can read/stream/copy out; mutation/commit methods are absent at type level or throw a dedicated immutable error; mutable handles expose dirty/commit/root-event state |
| Local and remote update async iterable | Reactive apps need one framework-neutral stream of meaningful changes | HIGH | Tree handle exposes an `AsyncIterable` of typed loaded/staged/committed/remote-root/error/unloaded events; local changes are ordered; caller-provided remote subscription is merged; iterator cancellation/unload tears down subscription |
| Remote update/rebase policy | Remote roots may arrive while local work is staged | HIGH | Never silently discard or overwrite staged changes; emit a conflict/divergence event and require explicit refresh/rebase/discard choice; clean trees may advance automatically only under documented policy |
| Abort, progress, and lifecycle callbacks | Multi-server uploads and long traversals need observability and cancellation | MEDIUM | Accept `AbortSignal`; callbacks for fetch/upload/progress/commit/error are consistently ordered; thrown callback errors and aborts have documented propagation; cleanup runs on failure |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Functional-first public API | Downstream libraries can reuse codec, crypto, traversal, builders, and root helpers without adopting client state | HIGH | Keep functions independently testable and make the client a thin composition layer |
| Portable `fs/promises` mental model | Browser and Node applications get familiar operations without a Node filesystem dependency | HIGH | Use POSIX-style logical paths and web-native byte/stream types; avoid pretending to implement OS permissions, file descriptors, or symlinks |
| Staging with inspectable explicit commits | Enables batched edits, preview, retry, and predictable publication/cost boundaries | HIGH | Expose dirty state and staged change summaries; content-addressed immutability makes bottom-up reuse natural |
| Modular loaded-tree lifecycle | Lets one app efficiently handle many mutable and immutable trees with isolated state | HIGH | Shared client configuration plus tree-local roots/caches/subscriptions avoids both duplicated setup and global mutable state |
| Framework-neutral reactivity | Async iterables work in vanilla TypeScript, UI frameworks, and server runtimes | HIGH | Typed events should include source and old/new roots; adapters to RxJS/framework stores belong downstream |
| Streaming integrity pipeline | Users receive bounded-memory reads without weakening verification | HIGH | Verify ciphertext hash and CHK plaintext hash per chunk before emitting; abort stops remaining fetches |
| Full visibility-mode ergonomics | Many implementations are likely to handle only public roots; first-class link/owner privacy reduces application crypto mistakes | HIGH | Factories should make secret-bearing references explicit and prevent accidental logging/server transmission |
| Existing Blossom multi-server composition | Trees gain preflight, mirroring, auth/payment retry, and server fallback already proven in this SDK | HIGH | Reuse action behavior through injected storage adapters; do not duplicate HTTP flows in Hashtree modules |
| Type-safe capability and error model | Compile-time distinctions and stable error codes make protocol edge cases manageable | MEDIUM | Discriminated unions for node/link/reference/visibility/update types; dedicated validation, integrity, not-found, conflict, immutable, and callback errors |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-commit every mutation | Feels like a simple remote filesystem | Creates excessive uploads/events, removes batching, complicates partial failure, and violates the project decision | Stage locally; require explicit `commit()`; optionally provide an application-level debounce helper later |
| Built-in relay pool or `nostr-tools` runtime dependency | Appears turnkey | Couples the SDK to one relay stack, inflates the isolated subpath, and conflicts with existing callback injection | Require query/publish/subscribe/sign/NIP-44 callbacks; publish optional adapters separately if demand emerges |
| Flatten Hashtree onto the root export | Easier discovery | Makes all consumers pay bundle/dependency cost and violates module isolation | Dedicated `blossom-client-sdk/hashtree` export and documentation link from root docs |
| Buffer-only file reads | Simplest return type | Fails for large files and undermines BUD-17 scalability | Streaming primary API plus explicit `Blob`/`Uint8Array` convenience assembly |
| Node `fs` API parity | Familiarity | File descriptors, permissions, symlinks, watchers, OS paths, and synchronous calls do not map to immutable portable manifests | Mirror the useful async vocabulary and define Hashtree-specific semantics explicitly |
| Send keys to Blossom for convenience | Could simplify server fetch/decrypt gateways | Turns bearer secrets over to storage operators and violates BUD-15/16/18 | Fetch ciphertext by hash, decrypt locally, strip secret query parameters from all server requests |
| Skip integrity checks on cache hits or streams | Saves hashing work | BUD-15 explicitly makes both checks security-critical; remote/cache corruption becomes undetected | Verify on ingress before cache insertion and before plaintext is accepted; cache only verified objects |
| Configurable canonical chunk size/fanout for normal writes | Seems flexible | Different values produce different roots and break cross-implementation determinism | Writers always use 2 MiB/174; readers enforce safe bounds and may read explicitly supported legacy forms |
| Expose internal fanout nodes in `readdir` | Easy implementation | Leaks storage structure and contradicts BUD-17 visible-directory semantics | Flatten `t=3`; expose raw/debug node inspection only as a clearly low-level primitive |
| Silently resolve unknown link types as blobs | Forward-compatible appearance | Causes type confusion and unsafe traversal; BUD-16 requires unsupported-type errors | Preserve unknown data only in raw tooling; normal readers return a typed unsupported error |
| Silently fast-forward over staged edits | Makes remote subscriptions look live | Can lose local work and produces nondeterministic commits | Emit divergence and require explicit conflict policy |
| Unbounded decoded/blob caches | Maximizes repeat-read speed | Dynamic tree loading can retain arbitrary remote data and secrets indefinitely | Per-tree bounded caches, explicit clear/unload, and optional caller-provided cache strategy |
| Filesystem materialization in core | Convenient for CLI use | Adds Node-only coupling and path traversal risk to a browser-compatible library | Return portable bytes, streams, entries, and metadata; filesystem adapters live outside core |
| Collaborative merge/CRDT semantics in v1 | Attractive for concurrent editing | BUD-18 defines replaceable roots, not a merge protocol; semantics would be product-specific and large | Detect divergence, expose old/new roots and staged changes, let downstream code choose merge behavior |

## Feature Dependencies

```text
BUD-15 CHK + BUD-16 canonical codec
    ├──> BUD-17 file chunking/fanout + safe traversal
    │        ├──> streaming read/write + Blob convenience
    │        └──> filesystem-like tree operations
    └──> BUD-18 URI/nhash + visibility/root events
             └──> mutable/immutable reference resolution

Existing Blossom actions + callback contracts
    └──> storage adapter/orchestration
             └──> explicit commit pipeline

Functional builders/traversal + root resolution + storage adapter
    └──> overall client
             └──> dynamically loaded tree handles and caches
                      ├──> staged fs/promises operations
                      ├──> explicit commits
                      └──> merged local/remote async-iterable updates

Remote subscription + staged state
    └──> divergence detection (required before any auto-refresh policy)
```

### Dependency Notes

- **BUD-17 requires BUD-16:** file and fanout manifests reuse the same MessagePack node/link encoding and validation model.
- **BUD-18 requires BUD-15/16/17:** a reference resolves a root, may recover a key, decrypts with CHK, then traverses directory/file nodes.
- **Streaming requires recursive file traversal:** stream order and per-chunk verification come directly from ordered `t=1` links.
- **Filesystem mutations require deterministic builders:** every edit reconstructs changed ancestors and must produce canonical bytes/hashes.
- **Commit requires storage before publication:** referenced chunks/manifests must be available before publishing a root event that points to them.
- **Reactive remote updates require caller subscription:** the SDK merges an async iterable but does not own relays.
- **Safe auto-advance conflicts with dirty state:** a clean handle may follow a newer root; a dirty handle must surface divergence rather than overwrite staged changes.
- **Visibility requires injected NIP-44 only for owner recovery:** public and link-private XOR/keyId primitives are local; owner-private encryption/decryption is delegated.

## MVP Definition

For this milestone, “MVP” means complete draft-protocol interoperability, not a reduced protocol subset. Client conveniences should follow only after the foundation passes vectors.

### Launch With (v1)

- [ ] Isolated Hashtree subpath and portable public types/errors
- [ ] Complete BUD-15 crypto and URI parameters with mandatory integrity checks and vectors
- [ ] Complete BUD-16 codec, validation, path rules, metadata, and vectors
- [ ] Complete BUD-17 canonical file/directory construction, traversal, bounds, and vectors
- [ ] Complete BUD-18 mutable/immutable references, root selection/publication helpers, `nhash`, and all visibility modes
- [ ] Callback-driven Blossom storage and Nostr/NIP-44 integration
- [ ] Streaming large-file reads and explicit whole-`Blob` convenience
- [ ] Functional interoperability suite against the reference implementation
- [ ] Overall client with independently loadable/unloadable tree handles
- [ ] Full staged async filesystem surface: read, write, list, stat, mkdir, remove, rename/move, copy, metadata
- [ ] Explicit retry-safe commit and typed async-iterable local/remote updates

### Add After Validation (v1.x)

- [ ] Caller-pluggable persistent cache adapter — add after in-memory cache keys, invalidation, and secret handling are proven
- [ ] Fine-grained range reads over file manifests — add when consumers demonstrate media/random-access needs; whole-file streaming remains required first
- [ ] Tree diff/commit preview helpers — add once stable staged-change types exist
- [ ] Optional framework/RxJS adapters — keep outside core and add only for demonstrated ecosystem demand
- [ ] Optional reference-implementation legacy fanout compatibility beyond the BUD-required read form — isolate from canonical writers

### Future Consideration (v2+)

- [ ] Conflict merge strategies — BUD-18 does not standardize collaborative merging; first expose divergence safely
- [ ] Offline durable workspaces — requires persistence, key protection, migrations, and replay semantics beyond an SDK in-memory tree handle
- [ ] Garbage-collection/reachability planning — useful for storage management but separate from interoperable creation/resolution
- [ ] Gateway or local filesystem adapters — valuable products, but Node/server-specific and outside the portable subpath

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| BUD-15 crypto/integrity | HIGH | HIGH | P1 |
| Canonical codec and validation | HIGH | HIGH | P1 |
| BUD-17 chunk/fanout builders and traversal | HIGH | HIGH | P1 |
| BUD-18 URI/nhash/root visibility lifecycle | HIGH | HIGH | P1 |
| Storage/Nostr callback adapters | HIGH | HIGH | P1 |
| Streaming reads + `Blob` convenience | HIGH | HIGH | P1 |
| Reference interoperability suite | HIGH | HIGH | P1 |
| Staged fs/promises-like tree API | HIGH | HIGH | P1 |
| Explicit commit pipeline | HIGH | HIGH | P1 |
| Dynamic loaded-tree lifecycle/caches | HIGH | HIGH | P1 |
| Async-iterable local/remote updates | HIGH | HIGH | P1 |
| Persistent cache adapter | MEDIUM | HIGH | P2 |
| Range reads and commit diff helpers | MEDIUM | MEDIUM | P2 |
| Framework-specific reactive adapters | LOW | MEDIUM | P3 |
| Automatic merge/offline workspace | MEDIUM | HIGH | P3 |

**Priority key:**

- P1: Required for the stated milestone and complete BUD-15/16/17/18 support
- P2: Valuable follow-on after core behavior stabilizes
- P3: Ecosystem adapter or separate product concern

## Ecosystem / Reference Feature Analysis

| Feature | Draft BUDs | Published `hashtree-core` reference | Recommended SDK Surface |
|---------|------------|-------------------------------------|-------------------------|
| CHK crypto | Exact algorithm, checks, vectors | CHK encrypt/decrypt and content hashing | Stateless WebCrypto-compatible functions with typed results/errors |
| Node codec | Canonical MessagePack and strict types | Encode/decode, link metadata, canonical directory ordering | Public codec plus strict validation; never make raw decode imply trusted node |
| File construction | 2 MiB chunks, 174 links, recursive manifests | Builder and stream builder patterns | Functional builder accepting bytes/stream and injected blob sink |
| Directory operations | Named entries, traversal, fanout flattening | Directory build/find/set/remove/rename/move primitives | Low-level immutable mutations underneath fs/promises-style handle methods |
| Streaming | Required by project; compatible with ordered chunks | Streaming put/get patterns and progress | Web-native `ReadableStream` and/or async iterable, plus `Blob` assembly |
| Visibility | Public/link-private/owner-private roots | Visibility and XOR helpers | Protocol helpers plus injected NIP-44 callbacks; explicit secret-bearing types |
| Mutable naming | kind `30064` replaceable root event | Resolver ecosystem exists outside core | Query/select/build/publish functions, then loaded mutable handle |
| Client state | Not standardized | Reference core mainly exposes storage/tree primitives | Project differentiator: shared client plus isolated dynamic tree instances |
| Commit semantics | New root publication is defined; staging API is not | Low-level immutable operations naturally yield new roots | Project differentiator: staged working root and explicit atomic publication boundary |
| Reactive updates | Not standardized | Not a BUD core feature | Project differentiator: merge local events with injected remote event iterable |

## Behavior Checklist for Roadmap Acceptance

The roadmap should assign tests for these observable behaviors, not only implementation tasks:

- Identical plaintext and mode produce identical ciphertext, manifest bytes, and roots; official vectors match byte-for-byte.
- Corrupt ciphertext, wrong advertised hash, wrong CHK key, invalid GCM tag, malformed MessagePack, invalid names, duplicate names, unknown types, malformed fanout, and exceeded bounds all fail closed with classified errors.
- Plaintext and encrypted trees both support the same path and filesystem operation matrix.
- Large reads emit verified chunks in order without assembling the whole file; cancellation stops fetching.
- Secret keys never appear in Blossom fetch/upload requests, generic progress/error messages, or cache keys that stringify into logs.
- A staged write is immediately readable from the handle but causes no publish; a successful commit publishes exactly the intended new root; a failed commit preserves retryable staged state.
- Loading two trees yields isolated roots/caches/staged state; unload closes only that tree's subscription and makes lifecycle behavior explicit.
- Remote roots advance a clean tree according to policy, but a dirty tree emits divergence and retains its local changes.
- Immutable `nhash` handles cannot publish mutable roots; mutable `npub/tree` handles select the correct latest event and tie-break deterministically.
- Public, link-private, and owner-private roots round-trip, including wrong/missing link keys and owner recovery paths.

## Sources

- [BUD-15 primary draft PR #104](https://github.com/hzrd149/blossom/pull/104) — algorithm, integrity rules, URI fields, security properties, vectors (MEDIUM; primary draft, open)
- [BUD-16 primary draft PR #105](https://github.com/hzrd149/blossom/pull/105) — canonical directory encoding, traversal, validation, vectors (MEDIUM; primary draft, open)
- [BUD-17 primary draft PR #106](https://github.com/hzrd149/blossom/pull/106) — canonical chunking/fanout, traversal, safety, vectors (MEDIUM; primary draft, open)
- [BUD-18 primary draft PR #107](https://github.com/hzrd149/blossom/pull/107) — reference forms, root events, visibility, `nhash`, resolution errors (MEDIUM; primary proposal)
- [Published `hashtree-core` reference crate](https://docs.rs/crate/hashtree-core/latest) — reference implementation evidence for builders, streaming, traversal/mutation, codec, CHK, `nhash`, and visibility primitives (MEDIUM; implementation source, cross-check)
- [Published `git-remote-htree` crate](https://docs.rs/crate/git-remote-htree/latest) — user-facing evidence for public, link-visible, and private tree workflows (MEDIUM; reference ecosystem implementation)
- [Node.js `fs/promises` API](https://nodejs.org/api/fs.html#promises-api) — ergonomic vocabulary only, not a requirement for OS-level semantic parity (HIGH for API vocabulary; official documentation)

---
*Feature research for: blossom-client-sdk Hashtree support*
*Researched: 2026-08-09*
