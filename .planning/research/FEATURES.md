# Feature Landscape

**Domain:** Experimental BUD-15 through BUD-18 hashtree support for `blossom-client-sdk`
**Researched:** 2026-07-25
**Confidence:** MEDIUM — upstream BUD PRs are still open, but the raw draft BUD text and existing SDK integration points are specific enough to plan v1.

## Table Stakes

Features users expect. Missing = v1 cannot honestly claim end-to-end hashtree support.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Experimental public API surface | The milestone requires BUD APIs while PRs #104-#107 remain draft/open. Consumers need clear opt-in semantics. | Low | Add under `src/experimental/hashtree/index.ts` or `src/hashtree/index.ts` with `experimental` naming in docs/types. Export from `src/index.ts`; add package subpath such as `./experimental/hashtree` or `./hashtree` in `package.json`. |
| CHK encrypt/decrypt primitive | BUD-15 is the cryptographic base for encrypted blobs, manifest keys, `nhash` keys, and link-private roots. | High | Implement `encryptChk`, `decryptChk`, `deriveChkKey`, and validation helpers in `src/hashtree/chk.ts`. Use Web Crypto/native-compatible AES-256-GCM + HKDF-SHA256; verify both `SHA256(ciphertext) == blob_hash` and `SHA256(plaintext) == chk_key`. Never accept arbitrary AES keys with the zero nonce. Tests: `tests/hashtree/chk.test.ts`. |
| CHK Blossom URI key support | BUD-15 extends `blossom:` parameters with `enc=chk-v1` and `k=<chk_key>`. Hashtree traversal must carry and consume child keys. | Medium | Extend or wrap existing `src/helpers/blossom-uri.ts` rather than changing legacy behavior destructively. Add parse/build helpers for encrypted blob references in `src/hashtree/uri.ts` or `src/helpers/hashtree-uri.ts`. Do not send `k` to Blossom servers. |
| Deterministic MessagePack tree node encode/decode | BUD-16 hashes depend on byte-identical MessagePack encoding, field order, sorting, integer encoding, and bin-vs-string rules. Without this, manifests from the SDK will not interoperate. | High | Implement canonical codec in `src/hashtree/manifest.ts`. Root fields: `l`, `t`. Link field order: `h`, `k`, `m`, `n`, `s`, `t`. Directory links sorted by UTF-8 bytes; file links preserve order. Add test vectors from BUD-16/BUD-17 in `tests/hashtree/manifest.test.ts`. |
| Directory manifest creation and validation | End users want to upload directory-like trees, not handcraft BUD-16 maps. | Medium | Provide `createDirectoryManifest(entries)` / `encodeDirectoryManifest()` with name validation, duplicate detection, path-safe segment handling, metadata validation, and size rollups. Target `src/hashtree/directory.ts`. |
| Directory manifest decoding, listing, and path traversal | Download/resolve APIs must walk paths and present directory contents. | Medium | Provide `decodeTreeNode`, `listDirectory`, `resolvePathInTree`, and typed link results. Validate unsupported `t`, duplicate names, invalid names, unsafe metadata, recursion depth. Target `src/hashtree/traverse.ts`. |
| Chunked large file creation | BUD-17 makes files larger than 2 MiB canonical via `t = 1` manifests and 2 MiB chunks. End-to-end upload must choose single blob vs file manifest automatically. | High | Provide `createFileTree(blob, options)` / `chunkFile()` using `chunk_size = 2097152` and `max_links = 174`; encrypt each chunk separately when encryption is enabled. Target `src/hashtree/file.ts`. |
| Chunked file download/reassembly | End-to-end download must reconstruct a file from recursive `t = 1` manifests and leaf chunks in order. | High | Provide `downloadHashtreeFile()` or lower-level `resolveFileManifest()` that fetches, verifies, optionally decrypts, and concatenates chunks. Support `AbortSignal`, `timeout`, `authEvents`, `onAuth`, and `onPayment` by passing through existing `DownloadOptions` from `src/actions/download.ts`. |
| Directory fanout support | BUD-17 large directories require `t = 3` fanout nodes with `m.count`, `m.first`, and `m.last`; v1 must not silently fail for large trees. | High | Writers MUST emit `t = 3`; readers MAY read old draft `t = 2` all-`_chunk_<start>` fanout only if compatibility is explicitly scoped. Add fanout vectors to `tests/hashtree/manifest.test.ts` and traversal tests. |
| Immutable `nhash` parse/build | BUD-18 immutable references are the stable permalink form for snapshots. | Medium | Provide `parseNhash`, `encodeNhash`, `parseHtreeURI`, `buildHtreeURI` in `src/hashtree/refs.ts`. Support TLV type `0` root hash, type `5` root key, and legacy 32-byte payload decode. Tests: `tests/hashtree/refs.test.ts`. |
| Mutable `htree://<npub>/<tree-name>/<path>` parsing/building | Mutable references are a core BUD-18 form for websites, repos, catalogs, backups, and app data. | Medium | Parse path segments safely: split before percent-decoding; tree name is exactly one segment and may contain encoded `/`. Include `k=<link_key>` handling for link-private roots without exposing it to server URLs. Target `src/hashtree/refs.ts`. |
| Mutable root event creation | SDK consumers need to publish hashtree roots without manually constructing tags. | Medium | Provide `createHashtreeRootEventTemplate()` and possibly `signHashtreeRootEvent()` callback flow using existing `Signer` types from `src/types.ts`. Use kind `30064`, `d=<tree-name>`, `hash=<root_hash>`, optional `l=hashtree`, plus visibility tags. Target `src/hashtree/roots.ts`; tests in `tests/hashtree/roots.test.ts`. |
| Mutable root resolution callback contract | The SDK has no relay client, so it must delegate event fetching like existing Nostr server-list behavior. | Medium | Add `getRootEvent(pubkey, treeName, kinds)` callback or `getRootEvents(filter)` callback in hashtree resolve options. Readers should query kind `30064` and MAY accept legacy `30078`. Keep relay integration out of scope. |
| All BUD-18 visibility modes | Project requirements explicitly require public, link-private, and owner-private roots in v1. | High | Public: optional `key` tag. Link-private: `encryptedKey = root_key XOR link_key`, `keyId`, and `k` query param. Owner-private: callback-provided NIP-44 decrypt/encrypt because SDK does not own identity/relay/session. Target `src/hashtree/roots.ts` and `src/hashtree/visibility.ts`. |
| End-to-end upload API | The user explicitly asked for APIs that create and upload hashtrees, not only protocol primitives. | High | Add `uploadHashtree(serverOrServers, input, opts)` and/or split `createHashtree()` + `uploadHashtreeTree()`. Compose existing `uploadBlob()` from `src/actions/upload.ts` and optionally `multiServerUpload()` from `src/actions/multi-server.ts`. Return root hash, optional root key, `nhash`, `htree` URI, uploaded blob descriptors, and root event template. Target `src/actions/hashtree.ts` or `src/hashtree/actions.ts`; export from `src/actions/index.ts`. |
| End-to-end resolve/download/decrypt API | v1 must resolve `htree://`, download needed Blossom blobs, verify hashes, decrypt CHK content, and return files/directories. | High | Add `resolveHashtree(ref, opts)`, `downloadHashtreeFile(ref, opts)`, and `listHashtreeDirectory(ref, opts)`. Compose `downloadBlob()` and existing auth/payment options. Return typed results (`file`, `directory`, `manifest`) rather than raw `Response` only. |
| Server hint/fallback support | Existing SDK resolve behavior supports `xs`, `getServers`, and fallback servers; hashtree should feel consistent. | Medium | Reuse `ResolveOptions` patterns from `src/actions/resolve.ts`: `fallbackServers`, `getServers`, `auth`, `authEvents`, `timeout`, `signal`. For `htree` immutable refs, allow explicit `servers`/`fallbackServers`; for mutable refs, use root-event metadata or caller-supplied servers. |
| Safety limits | BUD-16/17/18 require bounded manifest size, link count, recursion depth, total fetched bytes, and total plaintext bytes. | Medium | Add `HashtreeLimits` defaults in `src/hashtree/limits.ts`: max manifest bytes, max links per node, max recursion depth, max total manifests, max total download bytes. Every traversal/download API should accept overrides. |
| TypeScript types for tree input/output | SDK consumers need ergonomic and safe typed contracts. | Medium | Add exported types in `src/hashtree/types.ts`: `HashtreeNode`, `HashtreeLink`, `HashtreeEntryInput`, `HashtreeUploadResult`, `HashtreeResolveOptions`, `HashtreeVisibility`, `Nhash`, `HtreeReference`. Re-export from `src/index.ts` and subpath barrel. |
| Test-vector and HTTP orchestration tests | The repo's testing pattern expects pure helper tests plus mocked HTTP action tests. | Medium | Add `tests/hashtree/*.test.ts` for vectors/round trips and `tests/actions/hashtree.test.ts` for upload/download orchestration with `tests/fetch.ts` and `tests/mock-servers.ts`. Run `pnpm test`; browser tests only if DOM-facing helpers are added. |

## Differentiators

Features that set the SDK apart. Not strictly required for protocol compliance, but valuable for SDK consumers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Two-layer API: primitives plus batteries-included actions | Advanced consumers can use exact BUD primitives; app developers can use one-call upload/download. | Medium | Keep protocol modules pure under `src/hashtree/*`; compose HTTP in `src/actions/hashtree.ts`. This matches existing architecture and avoids turning primitives into fetch-dependent code. |
| Multi-server hashtree upload/mirroring | Blossom's practical value is redundancy across servers; hashtrees multiply blob count, so single-server upload is fragile. | Medium | Use existing `multiServerUpload()` from `src/actions/multi-server.ts` for leaves/manifests. Add progress callbacks such as `onBlobUpload`, `onManifestUpload`, `onSkip`, `onError`. |
| Manifest-first dry run / planning mode | Consumers often need to know how many blobs, total ciphertext bytes, and root references before uploading. | Medium | `createHashtree()` should return a DAG/upload plan without network I/O; `uploadHashtreePlan()` performs upload. Useful for payment UX and testing. |
| Progress and partial-result callbacks | Large trees may upload hundreds of chunks and manifests; callers need UI/progress hooks. | Medium | Include callbacks in action options: `onChunk`, `onManifest`, `onProgress`, `onResolveStep`. Keep optional and side-effect-free. |
| Selective directory listing without downloading whole tree | Large fanout directories should be navigable by path using `first`/`last` bounds. | Medium | Implement path lookup over `t = 3` bounds to fetch only needed fanout children; list operations can still flatten with limits. |
| Owner recovery helpers for link-private roots | Link-private shares are easy to lose if only the URL has the link key. BUD-18 allows owner recovery tags. | Medium | Provide helpers for `selfEncryptedKey` / `selfEncryptedLinkKey` via injected NIP-44 callbacks; do not bundle a relay/client identity manager. |
| Interop fixtures exported for downstream tests | Since BUDs are draft, downstream apps need fixtures to detect breakage when drafts change. | Low | Export test vectors from `src/hashtree/vectors.ts` or keep in tests only; prefer tests-only unless users request runtime access. |

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Server-side Blossom endpoint changes | The BUDs explicitly state servers store normal Blossom blobs; changing server assumptions would block adoption. | Compose existing `uploadBlob()`, `downloadBlob()`, `hasBlob()`, `mirrorBlob()`, and `multiServerUpload()` actions. |
| Built-in relay client for mutable roots | Existing SDK delegates Nostr event fetching; adding relay management would expand scope and dependencies. | Accept callback-injected root event lookup/publish helpers, mirroring `getServers` and `Signer` patterns. |
| Persistent local database / sync engine | Full sync, filesystem watching, cache invalidation, and local state are product features, not SDK v1 protocol support. | Return upload plans and typed results; let apps persist them. |
| Stable non-experimental API guarantee | BUD-15 through BUD-18 are unmerged drafts and may change. | Prefix/package hashtree exports as experimental and isolate implementation under hashtree modules. |
| Arbitrary encryption keys with CHK zero nonce | BUD-15 forbids this; it breaks confidentiality and integrity if a key is reused with zero nonce. | Always derive `chk_key = SHA256(plaintext)` and AES key via HKDF per blob/chunk/manifest plaintext. |
| Streaming CHK with one file-level key | BUD-15 says each chunk must derive its own key; file-level reuse with zero nonce is the likely catastrophic implementation error. | Chunk first, then CHK-encrypt each chunk independently. |
| Sending `k` or link-private keys to Blossom servers | Keys are bearer secrets and servers do not need them. | Strip key material from all fetch URLs and headers; use keys only locally after downloading by hash. |
| Treating unknown node/link types as blobs | BUD-16/17 require fail-safe unsupported-type errors. Guessing can corrupt traversal and hide malicious data. | Throw typed errors for unknown `t`, invalid fanout metadata, named file links, and named `t = 3` links. |
| Replacing existing `blossom:` URI behavior | The milestone says `htree://` support is additive. Breaking `parseBlossomURI()` would affect current users. | Add hashtree-specific wrappers/extensions and keep existing helper contracts backward compatible. |
| Full filesystem materialization API | Writing paths to disk safely is environment-specific and risky in browsers/Node. | Return typed entries and blobs/streams; document that callers must handle filesystem writes and path sanitization. |

## Feature Dependencies

```text
BUD-15 CHK primitives → encrypted chunks/manifests → encrypted directory links → htree root key handling
BUD-16 canonical MessagePack codec → directory manifests → BUD-17 file manifests/fanout → traversal/listing
BUD-17 chunking → large file upload → large file download/reassembly
BUD-17 fanout → large directory upload → selective path lookup/listing
BUD-18 nhash parser → immutable htree resolve → download/decrypt by immutable reference
BUD-18 mutable URI parser → root event callback → mutable root resolution → download/decrypt by mutable reference
BUD-18 visibility helpers → root event creation → link-private/owner-private mutable upload flows
Existing src/actions/upload.ts + src/actions/download.ts → hashtree upload/download actions
Existing src/actions/multi-server.ts → optional redundant hashtree upload/mirror workflow
src/actions/index.ts export update → public Actions.Hashtree access
src/index.ts and package.json exports update → public SDK import path
```

## MVP Recommendation

Prioritize v1 as an end-to-end vertical slice with strict protocol correctness:

1. **Protocol primitives with vectors** — CHK, canonical MessagePack nodes, `nhash`, `htree://`, and root event templates. This prevents building HTTP orchestration on unstable or unverified bytes.
2. **Create/upload API** — create a tree from file/directory inputs, CHK-encrypt requested content, chunk large files, build manifests/fanout, upload all blobs through existing action functions, and return `nhash` plus optional mutable root event template.
3. **Resolve/download/decrypt API** — parse immutable or mutable references, resolve root events via callbacks, fetch through existing Blossom actions, verify hashes, decrypt keys locally, traverse paths, and return typed file/directory results.
4. **All visibility modes** — public, link-private, and owner-private root support in helper APIs, with NIP-44 encryption/decryption injected by callbacks rather than bundled relay/session management.

Defer:

- **Relay client integration**: requires app-specific relay policy; provide callbacks instead.
- **Persistent cache/database**: useful but not required for protocol v1.
- **Filesystem writer/sync client**: risky and outside SDK scope.
- **Gateway HTTP server**: BUD-18 allows gateways, but this repo is a client SDK.
- **Legacy draft writer compatibility**: read legacy `30078` roots and possibly old fanout only where cheap; write only current `30064` and `t = 3` shapes.

## Suggested Public API Shape

```typescript
// Pure primitives, no network
encryptChk(plaintext: Blob | Uint8Array): Promise<ChkEncryptedBlob>
decryptChk(ciphertext: Blob | Uint8Array, chkKey: string, blobHash: string): Promise<Uint8Array>
encodeTreeNode(node: HashtreeNode): Uint8Array
decodeTreeNode(bytes: Uint8Array): HashtreeNode
parseHtreeURI(uri: string): HtreeReference
buildHtreeURI(ref: HtreeReference): string
parseNhash(nhash: string): NhashReference
encodeNhash(ref: NhashReference): string
createHashtreeRootEventTemplate(input: HashtreeRootInput): UnsignedEvent

// Networked actions, compose existing Blossom actions
createHashtree(input: HashtreeInput, opts?: CreateHashtreeOptions): Promise<HashtreePlan>
uploadHashtree(server: string | URL, input: HashtreeInput, opts?: HashtreeUploadOptions): Promise<HashtreeUploadResult>
multiServerUploadHashtree(servers: (string | URL)[], input: HashtreeInput, opts?: HashtreeMultiUploadOptions): Promise<HashtreeUploadResult>
resolveHashtree(ref: string | HtreeReference, opts: HashtreeResolveOptions): Promise<HashtreeResolvedEntry>
downloadHashtreeFile(ref: string | HtreeReference, opts: HashtreeResolveOptions): Promise<Blob>
listHashtreeDirectory(ref: string | HtreeReference, opts: HashtreeResolveOptions): Promise<HashtreeDirectoryListing>
```

Recommended implementation paths:

- `src/hashtree/chk.ts` — BUD-15 crypto.
- `src/hashtree/manifest.ts` — BUD-16/17 canonical MessagePack encode/decode.
- `src/hashtree/file.ts` — BUD-17 file chunking/reassembly helpers.
- `src/hashtree/directory.ts` — BUD-16 directory and BUD-17 fanout construction.
- `src/hashtree/traverse.ts` — path traversal, listing, safety limits.
- `src/hashtree/refs.ts` — BUD-18 `htree://` and `nhash` parsing/building.
- `src/hashtree/roots.ts` — BUD-18 kind `30064` root event templates and root resolution helpers.
- `src/hashtree/visibility.ts` — public/link-private/owner-private key handling.
- `src/hashtree/types.ts` — exported TypeScript contracts.
- `src/hashtree/index.ts` — experimental public barrel.
- `src/actions/hashtree.ts` — networked upload/resolve/download/list actions.
- `src/actions/index.ts` — export `./hashtree.js`.
- `src/index.ts` — re-export experimental hashtree namespace or barrel.
- `package.json` — add subpath export for hashtree API.
- `tests/hashtree/*.test.ts` and `tests/actions/hashtree.test.ts` — vectors, round trips, and mocked Blossom HTTP flows.

## Sources

- Local project context: `.planning/PROJECT.md`.
- Local integration map: `.planning/codebase/INTEGRATIONS.md`.
- Local testing patterns: `.planning/codebase/TESTING.md`.
- Existing action exports: `src/actions/index.ts`.
- Existing root exports: `src/index.ts`.
- Existing package subpath exports: `package.json`.
- Existing upload/download/resolve behavior: `src/actions/upload.ts`, `src/actions/download.ts`, `src/actions/resolve.ts`.
- BUD-15 PR #104 and raw draft: `https://github.com/hzrd149/blossom/pull/104`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-15-chk-encryption/buds/15.md`.
- BUD-16 PR #105 and raw draft: `https://github.com/hzrd149/blossom/pull/105`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-16-directory-manifests/buds/16.md`.
- BUD-17 PR #106 and raw draft: `https://github.com/hzrd149/blossom/pull/106`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-17-chunked-manifests/buds/17.md`.
- BUD-18 PR #107 and raw draft: `https://github.com/hzrd149/blossom/pull/107`, `https://raw.githubusercontent.com/mmalmi/blossom/codex/bud-18-hashtree-references/buds/18.md`.
