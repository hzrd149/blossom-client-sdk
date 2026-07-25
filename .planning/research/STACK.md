# Technology Stack Research: Experimental BUD-15 through BUD-18 Hashtree Support

**Project:** blossom-client-sdk
**Dimension:** Stack / dependencies / runtime APIs
**Researched:** 2026-07-25
**Overall confidence:** LOW per GSD provider classification; recommendations are still actionable because they are cross-checked against local project files and the referenced upstream PR text.

## Recommendation

Use a minimal TypeScript/Web API stack: keep `@noble/hashes` as the hash/hex primitive, add `@msgpack/msgpack` as the only manifest codec dependency, add `@scure/base` as the only bech32 dependency, and implement CHK encryption with native `globalThis.crypto.subtle` first. Do **not** add `nostr-tools`, Node `crypto`, `msgpack-lite`, CBOR, FlatBuffers, or a WASM crypto/codec dependency to runtime code for this milestone.

## Recommended Runtime Dependencies

| Package / API | Version | Dependency Type | Used For | Confidence | Why This Choice |
|---|---:|---|---|---|---|
| `@noble/hashes` | existing `^1.8.0` | existing production dependency | SHA-256, HKDF fallback if needed, hex encode/decode helpers | LOW | Already in `package.json` and used by `src/helpers/blob.ts`; avoids adding another hashing package. Keep all hash equality checks byte-exact and use existing helper patterns. |
| Web Crypto `globalThis.crypto.subtle` | Node >=18 + browsers | platform API | BUD-15 AES-256-GCM, HKDF-SHA256, SHA-256 digest if desired | LOW | BUD-15 specifically chose AES-256-GCM because it is widely available in browser WebCrypto and native crypto libraries; Node docs expose stable Web Crypto via `globalThis.crypto`. This matches the SDK's cross-runtime Web API architecture. |
| `@msgpack/msgpack` | `^3.1.2` | new production dependency | BUD-16/BUD-17 MessagePack encode/decode | LOW | TypeScript, universal JS, Node 18/browser support, `Uint8Array` bin support, decode limits, and reference PR discussion explicitly benchmarked `@msgpack/msgpack@3.1.2` for BUD-shaped manifests. |
| `@scure/base` | `^2.2.0` | new production dependency | BUD-18 `nhash` bech32 encode/decode | LOW | Small audited TypeScript base encoding library with bech32 `toWords`/`fromWords`, zero runtime dependencies, and large ecosystem use. Use it instead of pulling in `nostr-tools` for one bech32 primitive. |
| `TextEncoder` / `TextDecoder` | platform API | platform API | UTF-8 sorting, metadata strings, path/reference parsing | LOW | Already compatible with project `lib: ["ES2022", "DOM"]`; required by `@msgpack/msgpack` and cross-runtime path encoding. |
| `Blob`, `ReadableStream`, `Uint8Array`, `ArrayBuffer` | platform APIs | platform API | Node/browser binary inputs, chunking, uploads/downloads | LOW | Existing SDK already relies on `Blob`, `File`, `Buffer`, `fetch`, and DOM libs. Hashtree code should normalize to `Uint8Array` internally and expose `Blob`-friendly actions. |

### Install

```bash
pnpm add @msgpack/msgpack @scure/base
```

No new dev dependency is required for stack reasons. Existing `vitest`, `@vitest/browser`, `playwright`, and `nostr-tools` dev dependency are sufficient for Node/browser test vectors and Nostr event fixtures.

## Package.json Changes

Update `package.json`:

```json
{
  "dependencies": {
    "@noble/hashes": "^1.8.0",
    "@msgpack/msgpack": "^3.1.2",
    "@scure/base": "^2.2.0"
  }
}
```

Add public export surfaces only if implementation creates public modules:

```json
{
  "exports": {
    "./hashtree": {
      "import": "./lib/hashtree/index.js",
      "types": "./lib/hashtree/index.d.ts"
    },
    "./hashtree/*": {
      "import": "./lib/hashtree/*.js",
      "types": "./lib/hashtree/*.d.ts"
    }
  }
}
```

Prefer one experimental subpath (`blossom-client-sdk/hashtree`) plus root namespace export over many unrelated top-level exports. Keep all local TypeScript imports with `.js` suffixes because `tsconfig.json` uses `module: "NodeNext"` and `moduleResolution: "NodeNext"`.

## File Placement

Recommended source layout:

| File Path | Purpose |
|---|---|
| `src/hashtree/crypto.ts` | BUD-15 CHK encrypt/decrypt, key derivation, zero nonce constant, ciphertext/plaintext hash validation. |
| `src/hashtree/messagepack.ts` | BUD-16/BUD-17 deterministic encode/decode boundary wrapping `@msgpack/msgpack`. |
| `src/hashtree/manifest.ts` | Typed manifest/link structures, canonical ordering, validation, safety limits, chunk/fanout builders. |
| `src/hashtree/nhash.ts` | BUD-18 `nhash` bech32 TLV encode/decode using `@scure/base`. |
| `src/hashtree/reference.ts` | `htree://` parse/build for immutable `nhash` and mutable `npub/tree/path` references. |
| `src/hashtree/actions.ts` | End-to-end upload/download composition over existing `src/actions/*.ts`. |
| `src/hashtree/index.ts` | Experimental public barrel. |
| `tests/hashtree/*.test.ts` | Test vectors and round trips for CHK, manifests, nhash, htree parsing, and action composition. |

Wire `src/index.ts` to export a namespace such as `ExperimentalHashtree` or `Hashtree` with clear experimental docs. Do not flatten every primitive onto the root export.

## BUD-15 CHK Encryption Stack

### Prescriptive Implementation

Use Web Crypto for AES-GCM and HKDF:

1. Normalize plaintext to `Uint8Array`.
2. Compute `chk_key = SHA256(plaintext)` using existing `@noble/hashes/sha2.js` or existing helper equivalents.
3. Import `chk_key` as raw HKDF key material via `crypto.subtle.importKey("raw", chkKey, "HKDF", false, ["deriveKey"])`.
4. Derive an AES-GCM 256-bit `CryptoKey` using HKDF-SHA256 with spec-defined salt/info values from the final BUD text.
5. Encrypt with `{ name: "AES-GCM", iv: new Uint8Array(12), tagLength: 128 }`.
6. Compute Blossom blob hash over ciphertext.
7. On decrypt, first verify ciphertext hash when expected hash is known, decrypt, then verify `SHA256(plaintext) === chk_key`.

BUD-15's zero nonce is safe only under the content-derived-key invariant. Enforce the invariant in code: do not expose an API that accepts arbitrary AES keys with the fixed nonce. For BUD-17 chunks, derive a separate `chk_key` from each chunk plaintext; never reuse a file-level key across chunks.

### Optional Crypto Fallback

Do not add a fallback crypto dependency initially. If browser or Node test vectors expose Web Crypto incompatibility, add `@noble/ciphers` as an **optional internal fallback** only after a spike. Keep it out of the public API and only use it behind the same `chkEncrypt/chkDecrypt` functions.

### What Not To Use

- Do not use Node `node:crypto` in runtime source. It breaks browser compatibility and conflicts with the SDK's existing Web API-first pattern.
- Do not use random AES-GCM nonces for `chk-v1`; deterministic ciphertext is required for deduplication and test vectors.
- Do not use caller-supplied keys with the zero nonce.
- Do not skip ciphertext hash or plaintext hash validation; BUD-15 review calls these security-critical.

## BUD-16/BUD-17 Deterministic MessagePack Stack

### Prescriptive Implementation

Use `@msgpack/msgpack` only as a byte codec, not as the determinism policy. Build canonical plain objects/arrays in SDK code and then call `encode()`.

Rules to enforce before encoding:

- Emit compact BUD keys in exact canonical field order.
- Encode hashes and keys as `Uint8Array` so MessagePack uses bin, not str.
- Sort directory links by UTF-8 name bytes.
- Do not sort file chunk links; chunk order is semantic.
- Sort metadata keys by UTF-8 bytes.
- Omit absent optional fields rather than encoding `undefined`/`null` unless the BUD explicitly requires them.
- Validate node/link type separation: root `t` is node type; link `t` is linked object type.
- Implement BUD-17 `t = 3` directory fanout as structural type, not as `_chunk_<start>` name inference.
- Apply decode limits through `@msgpack/msgpack` decoder options and post-decode validators.

Recommended import pattern:

```ts
import { decode, encode } from "@msgpack/msgpack";
```

Use simple `encode(canonicalManifest)` for vectors. Only introduce reusable `Encoder`/`Decoder` instances if profiling shows repeated encode/decode overhead.

### What Not To Use

- Do not use `sortKeys: true` as the canonicalization strategy. It may sort object keys, but BUD determinism requires explicit field order, sorted directory links, unsorted file chunks, bin-vs-str guarantees, and optional field omission.
- Do not use `msgpack-lite`; it is older, less aligned with current TypeScript/browser requirements, and not the package discussed in the BUD PR benchmarks.
- Do not switch to CBOR, deterministic CBOR, canonical JSON/JCS, or FlatBuffers. The upstream PR discussion explicitly retains MessagePack for compactness, native byte arrays, mature Rust/TypeScript implementations, reference implementation compatibility, and benchmark results.
- Do not use JavaScript `Map` as the public manifest shape unless the encoder converts it to explicit canonical arrays/objects. Plain typed structures are easier to validate and document.

## BUD-18 `nhash` Bech32 TLV Stack

### Prescriptive Implementation

Add `@scure/base` and implement TLV locally:

```ts
import { bech32 } from "@scure/base";
```

Use `bech32.encode("nhash", bech32.toWords(tlvBytes), limit)` and `bech32.fromWords(words)` for decoding. Set an explicit bech32 length limit large enough for the BUD-18 test vectors and root-key TLV, but not unbounded.

Implement a tiny TLV codec in `src/hashtree/nhash.ts`:

- TLV item format: one-byte type, one-byte length, followed by value bytes.
- Type `0`: primary 32-byte root manifest hash.
- Type `5`: BUD-18-local root key, if present.
- Preserve the final PR's type table semantics; do not assume NIP-19 relay/author/kind meanings for every type unless BUD-18 says so.
- Decode legacy exactly-32-byte bech32 payload as hash-only; decode any other payload as TLV.
- Reject duplicate singleton fields unless the BUD explicitly permits multiples.
- Reject malformed lengths, unknown required fields, and non-32-byte hashes/keys.

### What Not To Use

- Do not add `nostr-tools` as a production dependency only for bech32. It is already dev-only for tests, and the SDK production Nostr integration is callback/structural rather than library-bound.
- Do not import NIP-19 helpers and try to shoehorn `nhash` into an existing `naddr`/`nevent` model; BUD-18 defines a distinct HRP and TLV namespace.
- Do not use browser `btoa`/`atob` or ad hoc base32 encoders for bech32.

## Mutable Hashtree Root / Nostr Stack

Keep Nostr signing and relay lookup callback-injected. BUD-18 root event handling should not introduce a relay client dependency.

Recommended approach:

- Define structural event types in `src/hashtree/types.ts` or reuse existing `SignedEvent`/`EventTemplate` from `src/types.ts`.
- Provide helpers to build/parse root event tags for kind `30064`.
- Accept a caller-provided callback for resolving mutable roots, e.g. `getHashtreeRoot(pubkey, treeName, options)`, instead of bundling relay pool logic.
- Readers may support legacy kind `30078` if the BUD PR keeps the compatibility note, but writers should emit `30064`.

Do not add `nostr-tools`, `@nostr-dev-kit/ndk`, relay pools, IndexedDB caches, or Nostr subscription managers to production dependencies for this milestone.

## Cross-Runtime Policy

| Concern | Decision |
|---|---|
| Node support | Preserve `engines.node >=18` from `package.json`. Do not require Node 20+ APIs. |
| Module format | Keep ESM-only with TypeScript `NodeNext`; source imports must include `.js` suffixes for local modules. |
| Binary type boundary | Normalize to `Uint8Array` internally; accept `Blob`/`File`/`ArrayBuffer`/`Uint8Array` where useful. |
| Browser crypto | Use `globalThis.crypto.subtle`; document secure-context requirement for browser CHK operations. |
| Node crypto | Use `globalThis.crypto.subtle`; do not import `node:crypto` in runtime modules. |
| Streams | Defer true streaming encryption/decryption unless required by a phase; chunking can use `Blob.slice()`/`arrayBuffer()` for canonical 2 MiB chunks initially. |
| Buffer | Do not require `Buffer` in hashtree modules; tolerate it only because it is a `Uint8Array` subclass in Node. |
| DOM | Keep DOM-only logic out of `src/hashtree/*`; hashtree should be usable in Node and workers. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| CHK crypto | Web Crypto | `node:crypto` | Node-only and contrary to browser SDK support. |
| CHK crypto fallback | No initial dependency; possible `@noble/ciphers` after spike | WebAssembly crypto libs | More supply-chain and bundle complexity than needed for AES-GCM/HKDF. |
| MessagePack | `@msgpack/msgpack` | `msgpack-lite` | Older ecosystem fit; not the package used in upstream BUD-shaped benchmark discussion. |
| Canonical encoding | Explicit SDK canonical builder + `@msgpack/msgpack` | `sortKeys: true` only | Insufficient for BUD field order, link order, bin-vs-str, and optional omission semantics. |
| Manifest format | MessagePack | CBOR / dCBOR | Upstream BUD has chosen MessagePack pre-merge after discussion; switching breaks vectors/reference implementation. |
| Manifest format | MessagePack | FlatBuffers | Larger payloads in upstream scratch benchmarks and adds schema/codegen complexity. |
| Bech32 | `@scure/base` | `nostr-tools/nip19` | Too broad for runtime dependency; `nhash` is BUD-local and can be encoded with low-level bech32. |
| Mutable root lookup | Callback-injected resolver | Bundled relay client | Out of scope and inconsistent with current SDK callback-injected architecture. |

## Verification Stack

Use existing tooling:

- `pnpm test` for Node vector and round-trip tests.
- `pnpm vitest run tests/hashtree/*.test.ts` for focused development.
- `pnpm vitest run --browser --browser.headless` for browser Web Crypto parity once CHK code lands.
- `pnpm build` to verify NodeNext ESM declarations and public export wiring.

Required test classes:

| Test Area | Required Coverage |
|---|---|
| CHK | BUD-15 vectors, deterministic ciphertext, wrong key/hash rejection, per-chunk key derivation. |
| MessagePack | BUD-16/BUD-17 byte vectors, directory input order invariance, file chunk order sensitivity, bin-vs-str decoding. |
| Fanout | 174-link boundary, `t = 3` fanout traversal, safe handling of literal `_chunk_0` user names. |
| `nhash` | BUD-18 vector, TLV round trip, legacy 32-byte decode rule, malformed TLV rejection. |
| Cross-runtime | Same vectors in Node and browser runner for Web Crypto and codecs. |

## Implementation Guardrails

- Mark public exports experimental in names or docs while PRs #104-#107 remain open.
- Keep dependencies production-minimal: exactly `@msgpack/msgpack` and `@scure/base` added unless a later phase proves crypto fallback is necessary.
- Keep server actions unchanged; hashtree actions should compose `uploadBlob`, `downloadBlob`, `mirrorBlob`, `hasBlob`, and multi-server helpers.
- Avoid module-level mutable state. Pass caches/auth/payment/root-resolution through options, following existing action patterns.
- Do not rely on BUD text copied into code comments as stable until upstream PRs merge; isolate constants and vector fixtures for easy updates.

## Sources

| Source | Notes | Confidence |
|---|---|---|
| `.planning/PROJECT.md` | Milestone requirements, user constraints, active decisions. | LOW |
| `.planning/codebase/STACK.md` | Existing TypeScript ESM, Node/browser, dependency, and test stack. | LOW |
| `.planning/codebase/ARCHITECTURE.md` | Existing functional action/helper architecture and export constraints. | LOW |
| `package.json` | Current dependencies, peers, exports, Node engine, scripts. | LOW |
| `tsconfig.json` | ES2022 + DOM + NodeNext constraints. | LOW |
| BUD-15 PR #104 | CHK algorithm and security review notes. | LOW |
| BUD-16 PR #105 | Deterministic MessagePack profile and encoding-choice discussion. | LOW |
| BUD-17 PR #106 | Chunk/fanout constants and `t = 3` fanout update. | LOW |
| BUD-18 PR #107 | `htree://`, kind `30064`, `nhash` TLV, visibility modes. | LOW |
| `@msgpack/msgpack` README | Node 18/browser TypeScript MessagePack support and API details. | LOW |
| `@scure/base` npm page | bech32 support, TypeScript declarations, zero dependencies, audit claims. | LOW |
| Node Web Crypto docs + MDN SubtleCrypto docs | Web Crypto availability and HKDF/AES-GCM APIs. | LOW |
