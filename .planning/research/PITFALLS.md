# Domain Pitfalls: Experimental BUD-15 through BUD-18 Hashtree Support

**Domain:** Client-side Blossom hashtrees in a TypeScript ESM SDK  
**Project:** `blossom-client-sdk`  
**Researched:** 2026-07-25  
**Overall confidence:** MEDIUM for local codebase risks; LOW for unmerged PR details fetched from GitHub web pages, cross-checked against `.planning/PROJECT.md`.

## Scope and Source Notes

This research targets pitfalls for adding experimental BUD-15 through BUD-18 support to the existing SDK without changing Blossom server behavior. Relevant local integration points are:

- `src/helpers/blob.ts` — whole-blob SHA-256 and hash caching.
- `src/actions/upload.ts` — upload preflight, auth/payment retry, metadata headers.
- `src/actions/download.ts` — download auth/payment retry and raw response return.
- Future likely paths: `src/helpers/hashtree/*`, `src/actions/hashtree*.ts`, `src/index.ts`, `src/actions/index.ts`, `package.json`, `tests/helpers/*`, `tests/actions/*`.

The upstream BUD PRs are still open. Treat all BUD-shaped APIs as experimental and design wrappers so spec churn changes internals and types locally instead of breaking stable SDK exports.

## Critical Pitfalls

Mistakes that can cause security failures, silent data corruption, or public API rewrites.

### Pitfall 1: Reusing an AES-GCM key with BUD-15's zero nonce

**What goes wrong:** BUD-15's `chk-v1` construction uses a fixed zero nonce. That is safe only when the AES key is deterministically derived from the exact plaintext being encrypted: `chk_key = SHA256(plaintext)`, then HKDF-SHA256 derives the AES-256-GCM key. If an implementation accepts caller-supplied keys, caches a file-level key, or encrypts multiple chunks under one key, the same `(key, nonce)` pair can encrypt different plaintexts.

**Why it happens:** A developer sees "CHK key" and treats it like a normal encryption key, or implements streaming/chunking by deriving one key for the whole file and reusing it for each chunk.

**Consequences:** AES-GCM nonce reuse leaks relationships between plaintexts and can allow ciphertext forgery. This is a cryptographic break, not merely a compatibility bug.

**Prevention:**

- Implement BUD-15 in a narrow helper such as `src/helpers/hashtree/chk.ts` with no API that accepts arbitrary AES keys.
- For single blobs, derive `chk_key` from the full plaintext bytes.
- For BUD-17 chunks, derive each chunk's `chk_key` from that chunk's plaintext, never from the file plaintext.
- Keep CHK helpers pure and deterministic; the only accepted decrypt key should be the BUD-level `chk_key` associated with that specific ciphertext.
- Add tests for two different chunks with the same file context proving their derived keys differ when plaintext differs.

**Detection / warning signs:**

- Function signatures like `encryptChunk(key, chunk)` or `encryptWithChkKey(chkKey, plaintext)` used for encryption.
- A loop in a chunker that calls HKDF once before iterating chunks.
- Test vectors pass for a one-chunk file but fail or are absent for multi-chunk files.
- Comments describing the zero nonce as "safe because deterministic" without mentioning per-plaintext key uniqueness.

**Files to watch:** `src/helpers/blob.ts`, future `src/helpers/hashtree/chk.ts`, future `src/helpers/hashtree/chunk.ts`, future `src/actions/hashtree-upload.ts`.

### Pitfall 2: Skipping BUD-15 commitment checks after decrypt

**What goes wrong:** The implementation decrypts AES-GCM ciphertext and returns plaintext without verifying both the downloaded ciphertext hash and the decrypted plaintext hash against expected values.

**Why it happens:** The existing SDK already addresses blobs by SHA-256 and `downloadBlob()` in `src/actions/download.ts` returns a `Response`; a higher-level hashtree downloader may assume "the server URL contained the hash, so the content is fine." It may also trust AES-GCM authentication alone.

**Consequences:** Wrong server content, malformed manifests, or crafted ciphertext can flow into tree traversal. AES-GCM is not key-committing; BUD-15's `SHA256(ciphertext) == blob_hash` and `SHA256(plaintext) == chk_key` checks are load-bearing.

**Prevention:**

- Hash every downloaded encrypted blob before decrypting and compare to the expected Blossom hash.
- Hash every plaintext after decrypting and compare to `k=<chk_key>` or the manifest child key.
- Fail closed with typed errors; never return partial plaintext on hash mismatch.
- Keep `downloadBlob()` raw, but have hashtree download helpers consume the response body exactly once, hash bytes, decrypt, and verify.

**Detection / warning signs:**

- Tests assert only that decryption returns bytes, not that wrong `blob_hash` and wrong `chk_key` reject.
- Hash mismatch errors are caught and converted into "try next server" without preserving the integrity failure.
- Resolver code treats mismatched content as a transient 404-equivalent instead of a hostile or corrupt blob.

**Files to watch:** `src/actions/download.ts`, future `src/actions/hashtree-download.ts`, future `src/helpers/hashtree/chk.ts`.

### Pitfall 3: Non-canonical MessagePack encodings produce different manifest hashes

**What goes wrong:** Two clients create semantically identical BUD-16/BUD-17 manifests but encode different bytes, producing different Blossom hashes and broken interoperability.

**Why it happens:** MessagePack itself is not automatically canonical. BUD-16 relies on a deterministic profile: fixed field order, sorted directory links by UTF-8 name bytes, sorted metadata keys, binary byte arrays rather than strings, shortest integer forms, and file chunk order preserved because order is semantic.

**Consequences:** Test vectors fail, `nhash` references do not resolve across implementations, duplicate content is uploaded under multiple hashes, and manifests created by this SDK cannot be read by reference implementations.

**Prevention:**

- Centralize all encoding in one module, likely `src/helpers/hashtree/manifest.ts`; do not let callers pass arbitrary MessagePack-ready objects directly to the encoder.
- Canonicalize before encoding: validate names, sort directory links by raw UTF-8 bytes, sort metadata keys, preserve file chunk order, and emit fields in the exact BUD order.
- Decode into typed structures, then re-encode in canonical form for round-trip tests.
- Pin and document the MessagePack library behavior; wrap it so library upgrades cannot silently change integer/bin/string representation.

**Detection / warning signs:**

- Encoder tests compare decoded objects but not exact bytes and hashes.
- Directory manifests generated from shuffled input produce different hashes.
- Metadata maps use JavaScript object insertion order without explicit sorting.
- Hashes change after upgrading the MessagePack package.

**Files to watch:** future `src/helpers/hashtree/manifest.ts`, `tests/helpers/hashtree-manifest.test.ts`, `package.json`.

### Pitfall 4: Directory fanout ambiguity and legacy draft compatibility

**What goes wrong:** BUD-17 changed directory fanout from a name-inferred draft form (`t = 2` with `_chunk_<start>` names) to a structural `t = 3` fanout node. If the SDK writes or primarily reasons about the old draft form, normal user directories can be misinterpreted as fanout nodes.

**Why it happens:** Reference implementations may still read legacy draft fanout for compatibility, and old notes mention `_chunk_<start>` internal links. A naive reader might infer fanout from names instead of node type.

**Consequences:** Real entries named `_chunk_0` can disappear, directory listings become wrong, path lookup is unsafe, and BUD-16-only readers may silently mis-list instead of failing safely.

**Prevention:**

- New writers MUST emit structural `t = 3` fanout nodes.
- Readers MAY accept the old draft `t = 2` all-`_chunk_<start>` shape only behind an explicit compatibility flag or isolated legacy decoder path.
- Fail closed on unknown node/link types; do not reinterpret unknown types as directories or blobs.
- Validate `t = 3` child links point only to `t = 2` or `t = 3` and include required metadata such as `count`, `first`, and `last` if the current BUD requires them.

**Detection / warning signs:**

- Code branches on `name.startsWith("_chunk_")` to decide tree semantics.
- Tests do not include a legitimate user directory containing `_chunk_0`.
- Unknown `t` values are coerced to `0` or `2`.

**Files to watch:** future `src/helpers/hashtree/manifest.ts`, future `src/helpers/hashtree/resolve-path.ts`.

### Pitfall 5: `htree://` mutable roots collide or resolve stale data

**What goes wrong:** BUD-18 mutable roots originally discussed NIP-78 kind `30078`, but current PR context moved to dedicated parameterized replaceable kind `30064`, while allowing readers to accept legacy `30078`. Using only `30078`, using the wrong `d` namespace, or querying relays without replaceable-event semantics can resolve unrelated or stale roots.

**Why it happens:** `30078` is common application-specific data; tree names like `website` or `backup` collide easily. Existing SDK code has Nostr auth helpers but no general relay query layer, so a new resolver may under-specify event kind and latest-event selection.

**Consequences:** Users fetch the wrong root manifest, link-private/owner-private roots leak or fail, and later API changes are required to correct kind/filter semantics.

**Prevention:**

- Write new mutable roots as kind `30064` only; read `30064` first and optionally read legacy `30078` as compatibility.
- Require a caller-injected relay/query adapter rather than baking in a relay dependency during this milestone.
- Explicitly implement replaceable event selection: `(pubkey, kind, d)` and latest valid event wins.
- Mark all mutable root APIs experimental and document current kind behavior.

**Detection / warning signs:**

- Filters query only `30078` or query both kinds without preference/order.
- APIs expose `kind?: number` as a casual option instead of a controlled compatibility mode.
- Multiple roots with same `d` produce nondeterministic results depending on relay response order.

**Files to watch:** future `src/helpers/hashtree/htree-uri.ts`, future `src/actions/hashtree-resolve.ts`, `src/nostr.ts`, `package.json` exports.

### Pitfall 6: Treating untrusted server and relay hints as safe fetch targets

**What goes wrong:** `htree://`, `nhash`, manifests, or Blossom URI parameters may carry server hints or references that cause the SDK to fetch arbitrary origins or relays.

**Why it happens:** Existing `resolveBlob()`/media behavior already converts untrusted `xs` hints into request targets, and hashtree traversal multiplies that by recursively resolving manifests and chunks.

**Consequences:** Browser clients can make unwanted cross-origin requests, gateways can become SSRF-style fetchers, and privacy leaks reveal which private tree paths a user is resolving.

**Prevention:**

- Add allowlist/filter callbacks for any server or relay hint used by hashtree APIs.
- Default high-level APIs to caller-provided server lists unless explicitly configured to honor embedded hints.
- Make gateway/server runtimes reject private-network, localhost, and non-HTTPS targets by policy outside the SDK, and document that requirement.
- Preserve existing raw action behavior, but make hashtree helpers expose a policy hook before recursive downloads begin.

**Detection / warning signs:**

- `new URL(hint)` flows directly into `downloadBlob()` with no caller veto.
- Tests resolve a tree using only embedded server hints and no policy callback.
- Browser examples load `htree://` content from untrusted posts without warning.

**Files to watch:** `src/actions/download.ts`, `src/actions/resolve.ts`, `src/media.ts`, future `src/actions/hashtree-download.ts`.

## Moderate Pitfalls

### Pitfall 1: Whole-blob buffering makes large hashtree operations non-scalable

**What goes wrong:** Existing `computeBlobSha256()` in `src/helpers/blob.ts` calls `blob.arrayBuffer()` for `Blob`/`File`, duplicating entire content in memory. CHK encryption, chunking, manifest building, and upload can add more full-buffer copies.

**Prevention:**

- Implement chunk-first APIs for BUD-17 so large files are sliced into canonical 2 MiB chunks before encryption/upload.
- Avoid computing both file-level and chunk-level hashes by buffering the entire file unless the BUD explicitly requires it.
- Use `Blob.slice()`/`Blob.stream()` where available; preserve `BlobHashSymbol` caching only for whole blobs where it remains safe.
- Add stress tests for files larger than one chunk and for many chunks; do not only test tiny strings.

**Warning signs:** memory spikes in browser uploads; tests use only `new Blob(["hello"])`; APIs accept only `ArrayBuffer` for plaintext; encrypted upload calls `getBlobSha256()` repeatedly for the same generated ciphertext.

**Files:** `src/helpers/blob.ts`, `src/actions/upload.ts`, future `src/actions/hashtree-upload.ts`.

### Pitfall 2: Upload action metadata bugs propagate to encrypted blobs and manifests

**What goes wrong:** `uploadBlob()` currently drops prepared metadata headers on the direct `PUT /upload` fallback after `HEAD /upload` returns `404`. Hashtree upload will upload ciphertext chunks and manifests through this path.

**Prevention:** Fix or work around the fallback header issue before building higher-level multi-blob upload flows. Ensure manifest uploads set appropriate content type if the spec/API expects it, and ensure encrypted blobs are uploaded with hashes of ciphertext, not plaintext.

**Warning signs:** hashtree tests mock only servers with `HEAD /upload` support; direct PUT fallback lacks `X-SHA-256`, `X-Content-Length`, or `X-Content-Type`; server descriptors are trusted without verifying returned hash.

**Files:** `src/actions/upload.ts`, `tests/actions/upload.test.ts`, future `tests/actions/hashtree-upload.test.ts`.

### Pitfall 3: Recursive traversal lacks safety limits

**What goes wrong:** Malicious or malformed manifests can create very deep trees, excessive fanout, repeated references, huge aggregate sizes, or cycles at the manifest graph level.

**Prevention:** Add configurable limits: max depth, max manifest count, max chunk count, max total plaintext bytes, max links per node, max path segments, and max concurrent downloads. Track visited manifest hashes during a resolution.

**Warning signs:** path resolution uses unbounded recursion; no visited set; no `AbortSignal` propagation; no total byte accounting; fanout test vectors pass but adversarial manifests are absent.

**Files:** `src/actions/download.ts`, future `src/helpers/hashtree/traverse.ts`, future `src/actions/hashtree-download.ts`.

### Pitfall 4: Confusing `s` manifest sizes with removed/optional BUD-10 `sz`

**What goes wrong:** Hashtree code may interpret URI `sz` as file plaintext size, encrypted plaintext size, or manifest blob size. Current PR discussion removed hashtree-specific `sz` examples and leaves content sizes to manifest `s` fields.

**Prevention:** Do not require or generate `sz` for `htree://` or hashtree-specific Blossom URIs. Use manifest `s` for content/aggregate size, and if a lower-level `blossom:` URI carries BUD-10 `sz`, treat it only as the size of the addressed blob being downloaded.

**Warning signs:** `plaintextSize = sz - 16`; multi-chunk file size computed from URI query; tests expect `?sz=` in `.bdir`/`.bfile` examples.

**Files:** future `src/helpers/hashtree/uri.ts`, existing `src/helpers/blossom-uri.ts`.

### Pitfall 5: `nhash` TLV decoding drifts from BUD-18

**What goes wrong:** `nhash` bech32 payloads include a legacy raw 32-byte hash-only form and a TLV form. Mis-decoding exactly 32 bytes as TLV, or assuming NIP-19 TLV type meanings without BUD-18's local table, breaks immutable references and root-key handling.

**Prevention:** Implement `nhash` encode/decode as its own helper with vector tests. Decode exactly 32 payload bytes as legacy hash-only; decode all other payload lengths as TLV. Reject duplicate/conflicting primary fields and unknown critical fields.

**Warning signs:** generic NIP-19 decoder accepts `nhash` with no BUD-specific validation; type `5` root key is treated as a relay/author/kind field; no malformed TLV tests.

**Files:** future `src/helpers/hashtree/nhash.ts`, `tests/helpers/hashtree-nhash.test.ts`.

### Pitfall 6: Experimental exports accidentally become stable

**What goes wrong:** Root exports, subpath exports, and docs expose hashtree helpers as normal stable SDK API while BUD-15 through BUD-18 remain open.

**Prevention:** Put all APIs under explicit experimental names/subpaths, e.g. `./experimental/hashtree` or `ExperimentalHashtree`, and include `@experimental` TypeDoc tags. Avoid flattening many symbols onto `src/index.ts`. Add package export smoke tests because the current `./actions` export is already known to drift from build output.

**Warning signs:** `src/index.ts` exports `encrypt`, `resolve`, or `uploadTree` at top level; `package.json` export paths are added without build/import tests; README presents APIs without experimental caveat.

**Files:** `src/index.ts`, `src/actions/index.ts`, `package.json`, `lib/`, `tests/index.test.ts`.

## Minor Pitfalls

### Pitfall 1: MIME type and extension expectations leak through encrypted content

**What goes wrong:** Encrypted chunks are opaque ciphertext, but upload and download helpers may preserve plaintext MIME/extension in a way that encourages servers or clients to treat ciphertext as media.

**Prevention:** Keep plaintext metadata in manifests where specified; upload ciphertext and manifests with deliberate content types, not accidental `File.type` from plaintext unless BUD/API explicitly wants that.

### Pitfall 2: Error messages hide which layer failed

**What goes wrong:** A failed `htree://` download can fail at URI parse, relay root lookup, manifest fetch, CHK decrypt, hash verification, path lookup, payment, or auth. Collapsing all failures into `HTTPError` or `Error("not found")` makes debugging impossible.

**Prevention:** Add typed errors or discriminated error codes for hashtree layers while preserving existing action errors.

### Pitfall 3: Payment/auth callbacks receive confusing hashes

**What goes wrong:** Existing `uploadBlob()`/`downloadBlob()` callbacks receive the blob hash. In hashtree flows, applications may expect plaintext file hash/root hash/path instead of ciphertext chunk or manifest blob hash.

**Prevention:** Document callback semantics clearly and pass contextual metadata in high-level hashtree callbacks: root reference, path, manifest hash, chunk hash, and plaintext size where available.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Files |
|-------------|----------------|------------|-------|
| Phase 1: CHK primitives | Zero-nonce AES-GCM key reuse; missing plaintext/ciphertext hash verification | Build tiny CHK module first, no arbitrary key encryption API, vector + negative tests | future `src/helpers/hashtree/chk.ts`, `src/helpers/blob.ts` |
| Phase 2: Manifest codec | Non-canonical MessagePack bytes and hash drift | Single canonical encoder/decoder, exact byte/hash vectors, shuffled-input tests | future `src/helpers/hashtree/manifest.ts`, `tests/helpers/*` |
| Phase 3: Chunking and fanout | Reusing one key across chunks; interpreting `_chunk_*` names as semantics; unbounded recursion | Per-chunk key derivation, write `t = 3`, legacy read isolated, traversal limits | future `src/helpers/hashtree/chunk.ts`, `traverse.ts` |
| Phase 4: `htree://` and `nhash` | Wrong event kind, stale mutable roots, TLV decode ambiguity | Prefer kind `30064`, optional legacy `30078`, injected relay adapter, dedicated `nhash` tests | future `src/helpers/hashtree/htree-uri.ts`, `nhash.ts` |
| Phase 5: End-to-end upload/download | Memory blowups, action-layer header bugs, auth/payment confusion | Fix direct PUT headers, propagate signal/timeout, bounded concurrency, contextual callbacks | `src/actions/upload.ts`, `src/actions/download.ts`, future `src/actions/hashtree-*` |
| Phase 6: Public exports/docs | Experimental API becomes de facto stable; export map drift | Experimental namespace/subpath, TypeDoc tags, package export smoke tests | `src/index.ts`, `package.json`, `lib/` |

## Verification Checklist for Each Implementation Phase

- Exact upstream test vectors pass for BUD-15, BUD-16, BUD-17, and BUD-18.
- Negative tests reject wrong ciphertext hash, wrong plaintext key, malformed MessagePack, unknown node/link types, invalid fanout metadata, and malformed `nhash` TLV.
- Round-trip tests cover browser-compatible `Blob` and Node `Buffer` inputs.
- Large-file tests cross the 2 MiB chunk boundary.
- All hashtree network actions propagate `AbortSignal` and `timeout` to `downloadBlob()`/`uploadBlob()` calls.
- Export tests import built package entrypoints after `pnpm build`.

## Sources

- Local: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`.
- Local: `src/helpers/blob.ts`, `src/actions/download.ts`, `src/actions/upload.ts`.
- External PR context (LOW confidence via webfetch; unmerged specs): BUD-15 PR #104, BUD-16 PR #105, BUD-17 PR #106, BUD-18 PR #107 in `hzrd149/blossom`.
