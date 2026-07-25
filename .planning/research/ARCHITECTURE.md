# Architecture Research: Experimental Hashtree Support

**Project:** blossom-client-sdk BUD-15 through BUD-18 support  
**Dimension:** Architecture  
**Researched:** 2026-07-25  
**Confidence:** MEDIUM — existing SDK architecture is clear; upstream BUD PRs are open drafts and should be treated as moving targets.

## Recommendation

Add hashtree as a new experimental protocol area parallel to existing Blossom HTTP actions, not as changes inside the existing blob upload/download primitives. Keep `src/actions/*.ts` focused on server endpoints, keep pure protocol codecs/helpers under `src/helpers/`, and add a thin `src/hashtree.ts` public experimental facade for end-to-end workflows.

The safest shape is:

```text
Consumer API
  ├─ src/hashtree.ts                         experimental high-level facade
  ├─ src/actions/hashtree.ts                 upload/download/resolve orchestration using existing actions
  └─ src/helpers/hashtree-*.ts               pure BUD codecs, CHK crypto, htree URI/nhash parsing

Existing SDK layers reused unchanged
  ├─ src/actions/upload.ts                   upload ciphertext, chunks, and manifests as ordinary blobs
  ├─ src/actions/download.ts                 fetch raw blobs by sha256
  ├─ src/actions/multi-server.ts             mirror ciphertext/chunks/manifests to server sets
  ├─ src/actions/resolve.ts                  keep blossom: resolution unchanged
  ├─ src/auth.ts                             reuse kind 24242 auth for Blossom server HTTP calls
  └─ src/nostr.ts                            add optional helpers for BUD-18 kind 30064 root lookup, not HTTP auth
```

Do **not** fold `htree://` into `src/helpers/blossom-uri.ts` or `src/actions/resolve.ts`. `blossom:` resolves one hash to one server URL; `htree://` can imply Nostr root lookup, `nhash` TLV decoding, recursive manifest traversal, CHK decryption, chunk assembly, and directory path resolution. Mixing those concerns would make the current simple resolver hard to reason about.

## Component Boundaries

| Component | Responsibility | Recommended files | Communicates With |
|-----------|----------------|-------------------|-------------------|
| CHK crypto helper | BUD-15 deterministic encrypt/decrypt for one plaintext blob/chunk; derive `chk_key = SHA256(plaintext)`, HKDF-SHA256 AES-256-GCM key, zero nonce, ciphertext/plaintext hash validation. | `src/helpers/hashtree-chk.ts`, tests in `tests/helpers/hashtree-chk.test.ts` | `src/helpers/blob.ts`, WebCrypto or optional crypto shim, high-level hashtree actions |
| Manifest codec | BUD-16/BUD-17 deterministic MessagePack encode/decode for tree nodes, link sorting, metadata sorting, node/link type validation, safety limits. | `src/helpers/hashtree-manifest.ts`, `src/helpers/hashtree-codec.ts`, tests in `tests/helpers/hashtree-manifest.test.ts` | MessagePack dependency, `src/helpers/blob.ts`, traversal/action layer |
| Chunking/tree builder | Split files into canonical 2 MiB chunks, max 174 links per node, create file manifests, directories, and `t = 3` directory fanout. | `src/helpers/hashtree-builder.ts`, tests in `tests/helpers/hashtree-builder.test.ts` | CHK helper, manifest codec, upload orchestrator |
| Hashtree reference helpers | Parse/build BUD-18 `htree://` references; encode/decode `nhash` bech32 TLV including legacy 32-byte hash-only decode. | `src/helpers/hashtree-uri.ts`, tests in `tests/helpers/hashtree-uri.test.ts` | `nostr-tools` or existing NIP-19 utilities if already available, hashtree resolver |
| Hashtree HTTP orchestration | Upload chunks/manifests through existing `uploadBlob`/`multiServerUpload`; download manifests/chunks through `downloadBlob`; assemble/decrypt outputs. | `src/actions/hashtree.ts`, tests in `tests/actions/hashtree.test.ts` | Existing action modules, helper modules, auth/payment callbacks |
| Hashtree root lookup/publish integration | Resolve mutable `htree://<npub>/<tree-name>/<path>` by querying latest kind `30064` root event; optionally publish root events through caller-provided Nostr callbacks. | Types in `src/actions/hashtree.ts`; small utilities in `src/nostr.ts` only if generic enough | Caller-provided relay/query/sign/publish callbacks; no relay pool dependency in SDK core |
| Experimental public facade | Stable import surface while drafts evolve; re-export hashtree types and functions with experimental naming/docs. | `src/hashtree.ts`, `package.json` export `./hashtree`, root export from `src/index.ts` optional as `Hashtree` namespace | Action/helper modules and package consumers |

## Data Flow

### Upload file or directory

1. Consumer calls an experimental API such as `uploadHashtree(servers, input, opts)` from `src/hashtree.ts` or `Actions.uploadHashtree` from `src/actions/hashtree.ts`.
2. The builder in `src/helpers/hashtree-builder.ts` normalizes input into leaf blobs and directory entries.
3. If encryption is enabled, `src/helpers/hashtree-chk.ts` encrypts each blob/chunk independently. Never reuse one file-level CHK key across chunks.
4. `src/actions/hashtree.ts` uploads each ciphertext chunk or raw blob with `multiServerUpload()` from `src/actions/multi-server.ts` so auth/payment/rejection behavior remains identical to normal Blossom uploads.
5. `src/helpers/hashtree-manifest.ts` encodes file manifests (`t = 1`), directories (`t = 2`), and directory fanout nodes (`t = 3`) deterministically.
6. `src/actions/hashtree.ts` uploads manifest blobs through `multiServerUpload()` and returns both raw root information and a BUD-18 reference: immutable `htree://<nhash>/<path>` when requested, mutable root metadata when caller will publish kind `30064`.
7. If mutable publishing is requested, do not make the SDK own a relay client. Accept callbacks such as `resolveHashtreeRoot`, `publishHashtreeRoot`, or `signHashtreeRootEvent`, matching the existing callback-injected architecture.

### Download/resolve file or directory

1. Consumer calls `resolveHashtree(ref, opts)` / `downloadHashtree(ref, opts)`.
2. `src/helpers/hashtree-uri.ts` parses `htree://`:
   - `htree://<nhash>/<path>` resolves directly to root hash/key metadata.
   - `htree://<npub>/<tree-name>/<path>` delegates to caller-supplied Nostr lookup for latest kind `30064` event, with optional legacy `30078` read compatibility while the draft settles.
3. `src/actions/hashtree.ts` downloads the root manifest blob using existing `downloadBlob(server, sha256, opts)` or a small internal server-candidate loop; reuse `fallbackServers`/server-hint concepts but do not call `resolveBlob()` unless the input is actually a `blossom:` URI.
4. Manifest codec validates MessagePack determinism, node type, link type, link count, metadata, path safety, and traversal limits.
5. Traversal selects the target link by path. Directory fanout descends only on `t = 3`; a `t = 2` directory is listed verbatim even if entries look like `_chunk_0`.
6. File manifests download chunks in order, validate hashes, decrypt each chunk if `k` is present, and concatenate into `Blob`/`Uint8Array` according to API options.
7. Directory APIs return structured entries by default; avoid eagerly downloading all file contents unless the caller explicitly asks for recursive materialization.

## Module and Export Plan

### Add these source files

| File | Purpose | Public? |
|------|---------|---------|
| `src/hashtree.ts` | Experimental facade and namespace-friendly exports for end-to-end hashtree APIs. | Yes: package subpath `./hashtree`; optionally root `export * as Hashtree from "./hashtree.js"`. |
| `src/actions/hashtree.ts` | Behavior layer for `uploadHashtree`, `downloadHashtree`, `resolveHashtree`, `listHashtreeDirectory`, and callback option types. | Yes via `src/actions/index.ts` and `./actions/hashtree`. |
| `src/helpers/hashtree-chk.ts` | BUD-15 crypto primitives and validation. | Yes via `src/helpers/index.ts` because consumers may need low-level vectors/tools. |
| `src/helpers/hashtree-manifest.ts` | BUD-16/BUD-17 manifest DTOs, encode/decode, validation. | Yes via helpers. |
| `src/helpers/hashtree-builder.ts` | Tree/chunk construction helpers. | Yes if useful; otherwise re-export only through `src/hashtree.ts`. |
| `src/helpers/hashtree-uri.ts` | BUD-18 `htree://` and `nhash` helpers. | Yes via helpers. |

### Update existing files

| File | Change |
|------|--------|
| `src/actions/index.ts` | Add `export * from "./hashtree.js";`. |
| `src/helpers/index.ts` | Add hashtree helper exports. |
| `src/index.ts` | Prefer `export * as Hashtree from "./hashtree.js";` rather than flattening every experimental symbol onto root. |
| `package.json` | Add `"./hashtree": { "import": "./lib/hashtree.js", "types": "./lib/hashtree.d.ts" }`. Existing `./actions/*` and `./helpers/*` cover implementation subpaths. |
| `src/const.ts` | Add `HASHTREE_ROOT_EVENT_KIND = 30064`, `HASHTREE_LEGACY_ROOT_EVENT_KIND = 30078`, `HASHTREE_CHUNK_SIZE = 2 * 1024 * 1024`, `HASHTREE_MAX_LINKS = 174` if public constants are desired. |
| `src/nostr.ts` | Only add generic helpers for extracting/creating hashtree root events if they are pure. Do not add relay networking. |
| `src/types.ts` | Add only shared public DTOs used by multiple modules; keep action option types local to `src/actions/hashtree.ts` to avoid worsening existing type import cycles. Use `import type`. |

## Patterns to Follow

### Pattern 1: Callback-injected Nostr integrations

**What:** Keep relay lookup/publish outside the SDK core and ask callers for callbacks.  
**Why:** Existing SDK integrates Nostr auth by callback (`onAuth`) and server discovery by callback (`getServers`); adding a relay pool dependency would be a major architecture change.

```typescript
export type HashtreeRootResolver = (request: {
  pubkey: string;
  treeName: string;
  kinds: readonly number[]; // [30064, 30078] during draft compatibility
}) => Promise<HashtreeRootEvent | undefined>;
```

### Pattern 2: Protocol codecs are pure helpers

**What:** CHK crypto, MessagePack encoding, `nhash`, and `htree://` parsing should have no network behavior.  
**Why:** Test vectors and deterministic hashing need isolated, byte-level tests independent of fetch mocks.

### Pattern 3: Existing action layer owns HTTP/auth/payment

**What:** Hashtree upload/download actions should delegate to `uploadBlob`, `downloadBlob`, and `multiServerUpload`.  
**Why:** This preserves kind `24242` auth reuse, Cashu payment handling, timeouts, rejection callbacks, and multi-server preflight behavior already implemented in `src/actions/*.ts`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extending `blossom:` URI helpers to parse `htree://`

`src/helpers/blossom-uri.ts` should remain a BUD-10-style blob URI parser. Add `src/helpers/hashtree-uri.ts` instead. The schemes differ semantically and operationally.

### Anti-Pattern 2: Adding relay clients or persistent stores

The milestone explicitly excludes a full sync client, gateway, or persistent database. Mutable root resolution should be callback-based and stateless.

### Anti-Pattern 3: One mega helper module

Avoid `src/helpers/hashtree.ts` containing crypto, MessagePack, URI, chunking, and traversal together. Splitting into `hashtree-chk`, `hashtree-manifest`, `hashtree-builder`, and `hashtree-uri` keeps phase work independently testable.

### Anti-Pattern 4: Top-level optional dependency imports

If a crypto or MessagePack library is added, ensure it is a justified direct dependency or dynamically imported where optional. Do not repeat the optional-peer mistake the existing architecture avoids for Cashu and HLS.

## Build Order That Minimizes Risk

1. **BUD-15 CHK primitives first**
   - Files: `src/helpers/hashtree-chk.ts`, `tests/helpers/hashtree-chk.test.ts`.
   - Rationale: Crypto correctness is the most dangerous foundation. Lock down deterministic encryption, zero-nonce invariants, per-chunk key derivation, and both SHA-256 validation checks before any tree code depends on it.

2. **BUD-16 deterministic manifest codec second**
   - Files: `src/helpers/hashtree-manifest.ts`, possibly `src/helpers/hashtree-codec.ts`.
   - Rationale: Every manifest hash depends on canonical bytes. Build encode/decode/test-vector coverage before upload orchestration, and enforce sorted directory links/metadata at the codec boundary.

3. **BUD-17 chunking and traversal third**
   - Files: `src/helpers/hashtree-builder.ts`, traversal helpers inside `src/helpers/hashtree-manifest.ts` or `src/helpers/hashtree-traversal.ts` if size warrants.
   - Rationale: Chunking depends on CHK and manifest codec. Implement file manifests, 2 MiB chunks, 174-link limits, and `t = 3` directory fanout before network APIs.

4. **Low-level action composition fourth**
   - Files: `src/actions/hashtree.ts`, `tests/actions/hashtree.test.ts`.
   - Rationale: Once local bytes are correct, compose with `multiServerUpload()`/`downloadBlob()` and fetch mocks. Start with immutable root upload/download to avoid Nostr mutable-root complexity.

5. **BUD-18 immutable references fifth**
   - Files: `src/helpers/hashtree-uri.ts`, `src/actions/hashtree.ts`.
   - Rationale: `nhash` and immutable `htree://<nhash>/<path>` are deterministic and do not require relay integration. They are the safest public resolution path.

6. **BUD-18 mutable roots last**
   - Files: `src/actions/hashtree.ts`, optional pure helpers in `src/nostr.ts`, constants in `src/const.ts`.
   - Rationale: Public/link-private/owner-private roots depend on all previous layers plus draft Nostr event semantics. Keep this phase isolated so changes to kind `30064`, legacy `30078` compatibility, or visibility key tags do not churn earlier code.

7. **Public export/documentation pass after behavior stabilizes**
   - Files: `src/hashtree.ts`, `src/index.ts`, `src/actions/index.ts`, `src/helpers/index.ts`, `package.json`, README/TypeDoc.
   - Rationale: Delay broad public surfacing until APIs are proven by tests. Export as experimental, preferably under a `Hashtree` namespace and `./hashtree` subpath.

## Scalability and Runtime Considerations

| Concern | Initial approach | Later pressure point |
|---------|------------------|----------------------|
| Large file memory | Start with Blob/Buffer APIs matching existing `UploadType`; chunk with `slice()` where available. | True streaming upload/download may require new stream-oriented APIs; do not block v1 on it. |
| Directory size | Enforce 174 links per node and traversal limits. | Add lazy directory iterators if recursive listings become expensive. |
| Server fanout | Reuse `multiServerUpload()` preflight/mirror behavior per blob/manifest. | Add concurrency limits for many chunks; avoid unbounded `Promise.all` over thousands of blobs. |
| Browser compatibility | Prefer WebCrypto for AES-GCM/HKDF, fallback or optional dependency only if Node/browser edge cases demand it. | Node 18 and older browser support should be validated in CI. |
| Mutable root resolution | Caller-provided Nostr callbacks. | A separate adapter package could offer relay-pool integration later. |

## Sources

- Existing project plan: `.planning/PROJECT.md`.
- Existing codebase maps: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`.
- Existing implementation seams: `src/actions/multi-server.ts`, `src/actions/resolve.ts`, `src/helpers/blossom-uri.ts`, `src/index.ts`, `src/actions/index.ts`, `src/helpers/index.ts`, `package.json`.
- Upstream draft context: BUD-15 PR #104, BUD-16 PR #105, BUD-17 PR #106, BUD-18 PR #107 in `hzrd149/blossom`.
