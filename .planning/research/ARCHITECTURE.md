# Architecture Research

**Domain:** Portable TypeScript SDK for content-addressed, optionally encrypted Hashtrees over Blossom and Nostr
**Researched:** 2026-08-09
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Dedicated public entrypoint: blossom-client-sdk/hashtree                │
│ Functional primitives        HashtreeClient        LoadedHashtree       │
│ (stateless, reusable)         (shared config)       (tree-local state)   │
└───────────────┬──────────────────────┬──────────────────────┬────────────┘
                │                      │ creates/loads         │
                ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Protocol core (no network, no root-entrypoint dependency)               │
│ CHK crypto │ canonical MessagePack │ chunk/fanout │ htree/nhash │ model │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ hashes, keys, encoded blobs, typed nodes
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Orchestration services                                                   │
│ resolver │ tree reader │ mutation builder │ commit planner │ update mux │
└───────────────┬───────────────────────────┬──────────────────────────────┘
                │                           │
                ▼                           ▼
┌────────────────────────────┐   ┌─────────────────────────────────────────┐
│ Blossom storage adapter    │   │ Caller-provided Nostr adapter callbacks │
│ existing download/upload/  │   │ query roots │ publish │ subscribe       │
│ multi-server actions       │   │ sign │ NIP-44 encrypt/decrypt           │
└────────────────────────────┘   └─────────────────────────────────────────┘
```

The dependency direction is strictly downward. Public client classes compose services; services compose protocol primitives and adapters; primitives never import clients, existing action barrels, or the package root. Blossom servers remain unaware of Hashtrees: encrypted chunks and manifests are uploaded as ordinary content-addressed blobs.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Protocol model | Own node/link/reference types, constants (`2 MiB`, `174`), validation limits, and domain errors. | `src/hashtree/types.ts`, `constants.ts`, `errors.ts`; types local to the subpath. |
| CHK codec | Hash plaintext, derive keys, encrypt/decrypt, and verify both stored ciphertext hash and recovered plaintext CHK. | Stateless WebCrypto-compatible functions; one independent CHK per chunk. |
| Manifest codec | Canonically encode/decode and validate node types 1, 2, and 3 with exact map ordering and sorting. | Pure MessagePack wrapper plus structural and resource-limit validation. |
| Chunk/fanout builder | Turn files and directory entries into bottom-up immutable DAG nodes. | Pure builders returning root link plus a deduplicated set/iterator of uploadable objects. |
| Reference codec | Parse/build `htree` URIs and `nhash` TLV values without performing I/O. | Pure parsing with segment-by-segment percent decoding. |
| Blob transport | Fetch and store opaque objects by hash, preserving auth/payment/server behavior. | Internal adapter over existing `resolveBlob`/`downloadBlob`, `uploadBlob`, and `multiServerUpload`. |
| Nostr root adapter | Query, sign, publish, subscribe, and perform NIP-44 root-key operations. | Caller-provided callbacks; no relay client or `nostr-tools` runtime dependency. |
| Resolver/reader | Resolve a mutable/immutable root, verify-fetch-decrypt-decode nodes, traverse paths, and expose file streams. | Stateless service parameterized by transport, Nostr callbacks, limits, and optional caches. |
| `HashtreeClient` | Own shared servers, Blossom callbacks, Nostr callbacks, policy/limits, and loaded-tree registry. | Thin facade/factory; does not own per-tree manifests or staged edits. |
| `LoadedHashtree` | Own one tree's base root, working tree, caches, staged operations, update queue, subscription, and lifecycle. | Dynamically created class with `commit()`, async filesystem methods, `updates()`, and idempotent `unload()`/`close()`. |
| Commit planner | Snapshot staged state, build changed DAG bottom-up, upload all objects, then publish root. | Explicit two-phase commit-like orchestration; retain stage on failure. |
| Update multiplexer | Merge local staged/committed events and remote root subscription events. | Per-tree async queue with cancellation, source labels, and serialized root application. |

## Recommended Project Structure

```text
src/
├── hashtree.ts                    # Dedicated public subpath barrel only
├── hashtree/
│   ├── types.ts                   # Public protocol/client contracts
│   ├── constants.ts               # BUD node types, chunk/link limits, event kind
│   ├── errors.ts                  # Typed parse, integrity, conflict, lifecycle errors
│   ├── crypto.ts                  # BUD-15 CHK primitives
│   ├── msgpack.ts                 # Minimal canonical MessagePack boundary
│   ├── manifest.ts                # BUD-16 node codecs and validation
│   ├── chunk.ts                   # BUD-17 file DAG construction/traversal
│   ├── fanout.ts                  # BUD-17 directory DAG construction/traversal
│   ├── reference.ts               # BUD-18 htree URI and nhash codecs
│   ├── root-event.ts              # Kind 30064 templates, selection, visibility keys
│   ├── storage.ts                 # Blossom transport interface + action adapters
│   ├── resolver.ts                # Root and path resolution
│   ├── stream.ts                  # Async byte stream and Blob assembly convenience
│   ├── mutation.ts                # Immutable working-tree edits and operation log
│   ├── commit.ts                  # DAG planning, upload, root publication
│   ├── updates.ts                 # Async queue and local/remote update merge
│   ├── loaded-tree.ts             # Per-tree stateful filesystem-like API
│   └── client.ts                  # Shared configuration and tree lifecycle
├── actions/                       # Existing Blossom HTTP actions, unchanged owner
└── index.ts                       # MUST NOT import or re-export hashtree
tests/
└── hashtree/
    ├── vectors/                   # Official BUD vectors and cross-implementation fixtures
    ├── crypto.test.ts
    ├── manifest.test.ts
    ├── chunk.test.ts
    ├── fanout.test.ts
    ├── reference.test.ts
    ├── resolver.test.ts
    ├── commit.test.ts
    └── client.test.ts
```

### Structure Rationale

- **`src/hashtree.ts`:** A single explicit package entrypoint enables tree-shaking and guarantees existing root consumers do not load Hashtree code or dependencies. Add `./hashtree` to `package.json` exports, but do not touch `src/index.ts`.
- **Protocol files:** Keep byte-level deterministic behavior independently testable. No protocol primitive should require a client instance, fetch, a server URL, or a Nostr event transport.
- **Service files:** Centralize resource limits and the repeated `fetch → hash verify → decrypt → plaintext verify → decode → validate` pipeline so filesystem methods cannot accidentally skip integrity checks.
- **Stateful files:** Restrict mutation to `LoadedHashtree`; this makes loading/unloading meaningful and prevents hidden global caches or subscriptions.
- **Existing `src/actions/`:** Preserve it as the only owner of Blossom HTTP auth/payment/retry semantics. Hashtree adapts those actions instead of duplicating endpoint logic.

## Architectural Patterns

### Pattern 1: Functional Core, Stateful Shell

**What:** Deterministic cryptography, encoding, validation, chunking, fanout, reference parsing, and event selection are exported functions. `HashtreeClient` and `LoadedHashtree` add configuration, caching, staging, and lifecycle only.

**When to use:** Always. It satisfies the milestone's functional-primitives-first requirement and lets downstream libraries use protocol logic without adopting the class API.

**Trade-offs:** More explicit parameter passing and more modules, but substantially easier vector testing, interoperability auditing, and reuse.

```typescript
const encrypted = await encryptChk(plaintext);
const root = buildDirectory(entries, { encrypted: true });

const client = new HashtreeClient({ storage, nostr, servers });
const tree = await client.loadTree("htree://npub.../photos");
await tree.writeFile("summer.jpg", plaintext);
await tree.commit();
```

### Pattern 2: Port Interfaces Around Existing Actions

**What:** Internal `BlobReader` and `BlobWriter` contracts decouple protocol orchestration from server selection. Default adapters call existing actions and translate their callbacks, results, and `Response` bodies into Hashtree objects.

**When to use:** Every resolver and commit path. Functional callers can also supply custom transports for gateways, tests, or local stores.

**Trade-offs:** Adds a narrow abstraction, but prevents Hashtree modules from coupling to `Actions` namespace barrels and keeps tests deterministic.

```typescript
interface HashtreeStorage {
  get(hash: string, options?: { signal?: AbortSignal }): Promise<Response>;
  put(blob: Blob, options?: { signal?: AbortSignal }): Promise<ReadonlyMap<string | URL, BlobDescriptor>>;
}

// Default implementation delegates to resolveBlob/downloadBlob and
// uploadBlob/multiServerUpload with shared auth/payment callbacks.
```

Use direct relative imports such as `../actions/multi-server.js`, never `../index.js` or the `Actions` namespace; this avoids root-entrypoint coupling and cycles.

### Pattern 3: Immutable DAG Plus Tree-Local Overlay

**What:** Committed blobs and manifests are immutable. A loaded tree keeps a base-root snapshot and a staged operation overlay. Reads see the overlay first and fall back to the immutable DAG; commit materializes only changed paths and ancestors.

**When to use:** All filesystem-like mutations (`writeFile`, `mkdir`, `remove`, `rename`, `copy`, metadata changes).

**Trade-offs:** Copy-on-write planning is more complex than eagerly rebuilding and uploading after every call, but enables explicit batching, cheap rollback, minimal upload sets, and predictable publication.

```typescript
type TreeState = {
  base: RootSnapshot;
  working: WorkingTree;
  staged: StagedOperation[];
  nodeCache: Map<string, Promise<DecodedNode>>;
  blobCache: SizeBoundedCache<string, Uint8Array>;
};
```

Cache keys must include both content hash and decryption-key identity (or a safe derived fingerprint) because the same ciphertext hash paired with a wrong key must not reuse successful plaintext. Promise-valued node-cache entries coalesce concurrent reads; rejected promises must be evicted.

### Pattern 4: Upload Before Root Publication

**What:** Commit freezes a staged snapshot, builds leaf objects and manifests bottom-up, uploads all content-addressed objects, then signs and publishes the new mutable root event last. The local base root advances only after the publication callback succeeds.

**When to use:** Mutable-tree commits. Immutable snapshots stop after uploads and return `nhash`.

**Trade-offs:** A failed publication can leave unreachable uploaded blobs, but publishing first can create a broken visible tree. Content-addressing makes safe retry and deduplication possible.

```text
freeze stage → build/encrypt leaves → build/encrypt ancestors → upload DAG
             → sign/publish kind 30064 → atomically advance local base → emit commit
```

Capture the stage generation at commit start. Mutations made during upload go into the next generation; they must not disappear when the committed snapshot is cleared. On upload or publication failure, retain the frozen stage for retry and do not emit a successful commit update.

### Pattern 5: Async-Iterable Updates With Explicit Lifecycle

**What:** A loaded tree owns one subscription task and one internal event queue. Local stage/commit events and valid remote kind `30064` roots enter the same ordered stream with a `source` discriminator.

**When to use:** Reactive consumers and remote mutable roots.

**Trade-offs:** Requires cancellation and backpressure policy. A bounded queue or coalescing of superseded remote roots prevents an idle consumer from causing unbounded memory use.

Remote updates must be serialized with commits. Apply only valid newer replaceable events; a newer remote root received while local changes are staged should emit a conflict/rebase-required update rather than silently overwriting the overlay. `unload()` aborts the subscription, closes iterators, clears caches, and removes the instance from the client's registry.

## Data Flow

### Read and Resolution Flow

```text
htree input
   ↓ parse segments independently
mutable npub/tree ──queryRoots callback──→ select latest valid kind 30064
immutable nhash ──decode TLV─────────────→ root hash + optional root key
   ↓
storage.get(hash) → verify ciphertext SHA-256 → optional CHK decrypt
                  → verify plaintext SHA-256 → decode/validate node
   ↓
directory lookup / verified fanout descent / recursive file-manifest traversal
   ↓
AsyncIterable<Uint8Array> (primary) → Blob assembly helper (convenience)
```

The primary file-read API should stream verified leaf chunks in manifest order. A convenience `readFileBlob()` may collect them into a `Blob`, but it must be visibly memory-buffering. Because AES-GCM authenticates a complete CHK object, each chunk is downloaded and authenticated before its bytes are yielded; the canonical 2 MiB chunk size bounds that buffer.

### Mutation and Commit Flow

```text
filesystem-like mutation
   ↓ validate path and preconditions
tree-local working overlay + staged operation log
   ↓ explicit commit (serialized by per-tree mutex/promise chain)
freeze generation → rebuild changed subtrees → canonical encode → optional CHK encrypt
   ↓
deduplicate objects by ciphertext hash → storage.put via existing upload actions
   ↓ all required uploads succeed according to configured policy
immutable tree: return nhash
mutable tree: build event → signer callback → publish callback → update base root
   ↓
invalidate affected path indexes, retain hash-addressed immutable cache entries, emit update
```

The storage policy must be explicit. For multi-server commits, decide whether success means at least one server, all requested servers, or a caller predicate over `multiServerUpload()` results. Defaulting silently to partial replication makes root durability ambiguous.

### Remote Subscription Flow

```text
subscribeRoots({ author, tree, kinds: [30064, optional 30078] })
   ↓ caller-owned AsyncIterable<SignedEvent>
validate signature contract / tags / author / d / hash / visibility fields
   ↓ replaceable-event ordering and stale-event suppression
resolve key locally → optionally prefetch/validate root → enqueue remote update
   ↓
no local stage: advance observed/base root according to policy
local stage: preserve overlay and emit conflict/rebase-required state
```

The SDK should validate event shape and selection rules, while signature verification may be either guaranteed by the query/subscription callback contract or injected explicitly. That contract must be documented; accepting unverified relay events implicitly is unsafe.

### State Management

| State | Owner | Lifetime | Notes |
|-------|-------|----------|-------|
| Servers, auth store, payment/auth callbacks | `HashtreeClient` | Client lifetime | Reuse existing `Set<SignedEvent>` auth cache across Hashtree uploads/downloads. |
| Nostr query/publish/subscribe/sign/NIP-44 callbacks | `HashtreeClient` | Client lifetime | Transport- and relay-library agnostic. |
| Validation/resource limits | Client defaults, overridable per operation | Client/operation | Thread through every recursive resolver; never hide as globals. |
| Current base root and latest root event | `LoadedHashtree` | Loaded lifetime | Root update is atomic after successful validation/publication. |
| Staged operation generations and working overlay | `LoadedHashtree` | Until commit/discard/unload | Commit snapshots one generation to allow concurrent later edits safely. |
| Decoded-node cache | `LoadedHashtree` | Loaded lifetime | Promise-coalesced and size/count bounded; content-addressed entries can survive root changes. |
| Plaintext/blob cache | `LoadedHashtree` | Loaded lifetime | Byte bounded; avoid caching large assembled files by default. |
| Subscription task and update queue | `LoadedHashtree` | Loaded lifetime | Abort and close on unload; handle bounded backpressure. |
| Encoded blobs awaiting upload | Commit-local | One commit attempt | Deduplicate by ciphertext hash; retain enough plan state for retry. |

## Scaling Considerations

For an SDK, scale is driven by tree size, concurrency, and blob volume rather than application user count.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small trees / files | In-memory overlays and decoded-node caches are sufficient; direct directory nodes and raw blobs avoid unnecessary manifests. |
| Large files / directories | Enforce 2 MiB chunking and 174-link fanout, lazy traversal, streamed reads, bounded caches, and concurrency-limited upload pools. |
| Many simultaneously loaded trees | Per-tree cache budgets and subscriptions; client registry supports explicit unload and optional global cache budget coordination. |
| High replication counts | Hash-deduplicate commit objects, preflight existing servers, upload with bounded concurrency, and expose a replication-success predicate. |

### Scaling Priorities

1. **First bottleneck — memory:** Unbounded plaintext caches or Blob assembly will fail before hashing or MessagePack. Stream chunks and bound caches by bytes, not just item count.
2. **Second bottleneck — request amplification:** Deep manifests and many servers multiply fetches/uploads. Promise-coalesce reads, deduplicate hashes, use fanout bounds, and cap concurrency.
3. **Third bottleneck — stale/concurrent roots:** Remote subscriptions and local commits can race. Serialize root transitions and surface conflicts explicitly.

## Anti-Patterns

### Anti-Pattern 1: Root Barrel Re-export

**What people do:** Add `export * from "./hashtree.js"` to `src/index.ts` or import the root barrel inside Hashtree code.
**Why it's wrong:** Existing consumers pay parse/bundle/dependency cost and cycles become likely; it violates the dedicated opt-in entrypoint decision.
**Do this instead:** Export only through `package.json` `./hashtree` mapped to `lib/hashtree.js`/`.d.ts`, and use direct internal imports.

### Anti-Pattern 2: Protocol Logic Inside Client Methods

**What people do:** Implement encryption, canonical encoding, traversal, and event parsing privately inside `LoadedHashtree`.
**Why it's wrong:** Functional consumers cannot reuse it, vectors become difficult to isolate, and stateful code can bypass validations inconsistently.
**Do this instead:** Make client methods thin orchestration over exported stateless functions.

### Anti-Pattern 3: Publish Root Before Upload Completion

**What people do:** Publish kind `30064` as soon as the new root hash is known.
**Why it's wrong:** Resolvers can observe a root whose manifests or chunks are unavailable.
**Do this instead:** Upload and verify the complete required DAG under a documented replication policy, then publish the root last.

### Anti-Pattern 4: Cache by Path

**What people do:** Cache decoded objects only by pathname.
**Why it's wrong:** Mutable roots change path meanings, rename/copy invalidation is error-prone, and different keys can protect objects.
**Do this instead:** Cache immutable objects by hash plus key identity and keep a root-generation-scoped path index separately.

### Anti-Pattern 5: One Global Mutable Client State

**What people do:** Put all roots, stages, caches, and subscriptions on `HashtreeClient`.
**Why it's wrong:** Trees cannot be independently unloaded, name collisions and cache invalidation cross boundaries, and remote updates become hard to route.
**Do this instead:** Client owns shared integration configuration; each loaded tree owns all tree-local state and teardown.

### Anti-Pattern 6: Treat `Response.body` as Already Verified Content

**What people do:** Stream network bytes directly to the user before hash/GCM verification.
**Why it's wrong:** BUD-15/17 require integrity verification before use; a final failure would occur after untrusted bytes were consumed.
**Do this instead:** Authenticate each bounded leaf chunk fully, then yield it. Never yield manifest bytes as file content.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Blossom servers | Default `HashtreeStorage` adapter over existing action functions. | Hashes only go to servers; CHK/root/link keys never do. Manifests and ciphertext use ordinary upload/download endpoints. |
| Nostr relays | Inject `queryRootEvents` and `subscribeRootEvents` callbacks returning events/async iterables. | SDK filters author, `d`, kinds and replaceable ordering; callback contract must state signature verification. |
| Nostr signer/publisher | Inject `signEvent` and `publishEvent` separately. | Lets callers coordinate relay acknowledgements; commit succeeds only under caller-selected publish policy. |
| NIP-44 | Inject encrypt/decrypt callbacks for `selfEncryptedKey` and `selfEncryptedLinkKey`. | Keep owner-private support independent of a Nostr library. |
| WebCrypto | Use standards-compatible hashing, HKDF, and AES-GCM boundary. | Node 18+ and modern browsers; isolate byte conversion and test official vectors in both environments if implementation differs. |

### Existing Action Integration

| Hashtree need | Existing action | Adapter behavior |
|---------------|-----------------|------------------|
| Fetch known blob from one server | `downloadBlob()` | Preserve `signal`, timeout, auth event reuse, `onAuth`, and `onPayment`; verify returned bytes independently. |
| Fetch using hints/fallback server resolution | `resolveBlob()` | Use for URI/server-hint strategy when appropriate; Hashtree still verifies the expected hash. Its current resolver does not pass download auth/payment callbacks, so the adapter may need direct `downloadBlob()` iteration for protected blobs. |
| Store on one server | `uploadBlob()` | Upload encoded/encrypted `Blob`; reuse existing 401/402 logic and ensure returned descriptor hash matches the planned object. |
| Replicate across servers | `multiServerUpload()` | Reuse preflight, mirror, auth/payment, rejection, and callbacks; interpret returned `Map` through explicit commit success policy. |
| Existence/preflight | `hasBlob()` / multi-server preflight | Optional optimization only; never replace content verification on reads. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Codec ↔ crypto | Bytes plus `{ hash, key }` value objects | Encryption wraps canonical plaintext bytes; decoding happens only after integrity checks. |
| DAG builder ↔ storage | Upload-object records `{ hash, bytes, type, key? }` | Keys remain local records and are embedded only in encrypted parent links/references as prescribed. |
| Resolver ↔ caches | Hash/key identity lookup returning verified bytes or validated nodes | Cache implementation is injected/tree-local; pure resolver remains callable without caching. |
| Client ↔ loaded tree | Factory plus registry lifecycle | Loading the same mutable identity should have a documented dedupe policy; unloading is explicit and idempotent. |
| Loaded tree ↔ commit planner | Immutable snapshot of base root and staged generation | Planner must not mutate live state; result is applied atomically by the tree. |
| Subscription ↔ loaded tree | Validated `RemoteRootUpdate` values | Subscription never directly mutates caches/stage; tree serializes application. |

## Suggested Build Order

1. **Shared types, errors, limits, and byte utilities.** Establish contracts and strict validation budgets used everywhere.
2. **BUD-15 CHK primitives.** Verify official vectors before any encrypted node construction.
3. **BUD-16 canonical MessagePack and directory nodes.** Exact bytes/hashes are prerequisites for every root.
4. **BUD-17 chunk/file and fanout builders/readers.** Add streaming leaf traversal and resource-bound enforcement.
5. **BUD-18 reference and root-event functions.** Implement URI/nhash codecs, replaceable-event selection, and visibility key recovery as pure functions.
6. **Storage adapters and stateless resolver.** Integrate existing download/upload actions only after protocol objects are stable.
7. **Mutation overlay and commit planner.** Build copy-on-write staging, bottom-up DAG creation, upload-before-publish semantics, failure retry, and replication policy.
8. **`LoadedHashtree`.** Layer the async filesystem API, caches, stage ownership, commit serialization, and stream/Blob reads over tested services.
9. **`HashtreeClient` and remote update multiplexer.** Add shared callbacks, dynamic load/unload, subscription cancellation, conflict signaling, and registry behavior.
10. **Dedicated export and end-to-end interoperability.** Add only `./hashtree` to `package.json`; confirm the root entrypoint has no Hashtree imports and run cross-implementation/vector scenarios.

This ordering keeps protocol hashes stable before stateful APIs depend on them and delays concurrency-heavy client behavior until reads, writes, and commits have independently testable contracts.

## Open Architecture Decisions for Phase Planning

- Define the exact multi-server commit success default: all servers, at least one, or caller-supplied predicate. Recommend caller predicate with a conservative documented default of all requested servers for mutable-root publication.
- Define conflict semantics when a newer remote root arrives over a staged local base. Recommend preserving the stage and requiring explicit `rebase`, `discard`, or forced commit rather than silent last-write-wins.
- Define signature-verification responsibility in Nostr callbacks. Recommend accepting only verified events by contract, with an optional injected verifier for defensive validation.
- Select and verify a canonical MessagePack implementation that permits exact field/integer/bin encoding; general-purpose object encoders may not provide byte-level control.
- Define browser-compatible upload payload conversion for streamed/generated chunks because existing `UploadType` is `Blob | File | Buffer`, not a generic `Uint8Array` or stream.
- Decide whether loaded immutable `nhash` trees expose mutation methods that create a new immutable snapshot, or remain read-only until explicitly forked. Recommend explicit `fork()` to avoid surprising identity changes.

## Sources

- [BUD-15 pull request](https://github.com/hzrd149/blossom/pull/104) and [draft source at PR head](https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md) — primary protocol source; CHK encryption and verification flow. **Confidence: MEDIUM**.
- [BUD-16 pull request](https://github.com/hzrd149/blossom/pull/105) and [draft source at PR head](https://github.com/hzrd149/blossom/blob/1b2f140b0d3fd06a907b159d7628e1d007588da3/buds/16.md) — primary protocol source; directory encoding and traversal. **Confidence: MEDIUM**.
- [BUD-17 pull request](https://github.com/hzrd149/blossom/pull/106) and [draft source at PR head](https://github.com/hzrd149/blossom/blob/1848f77c4a25b70d10a3963d66ba1c8aba1e4f2c/buds/17.md) — primary protocol source; chunking and fanout. **Confidence: MEDIUM**.
- [BUD-18 pull request](https://github.com/hzrd149/blossom/pull/107) and [draft source at PR head](https://github.com/hzrd149/blossom/blob/018f3e32227cf8fd1fba8dff2d39d6e3370d2d52/buds/18.md) — primary protocol source; references, root events, and visibility. **Confidence: MEDIUM**.
- Repository-local `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `src/index.ts`, `src/actions/*.ts`, `src/types.ts`, and `package.json` — current integration constraints and existing action contracts. **Confidence: HIGH**.

Overall confidence is MEDIUM because the four BUDs are draft proposals and key client lifecycle/conflict/replication semantics are product decisions not prescribed by the protocols. The protocol-derived boundaries are based on the exact PR-head source and cross-checked against the current SDK architecture.

---
*Architecture research for: blossom-client-sdk Hashtree Support*
*Researched: 2026-08-09*
