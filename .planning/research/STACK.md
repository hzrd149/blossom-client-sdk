# Stack Research

**Domain:** BUD-15/16/17/18 Hashtree support in a portable TypeScript ESM SDK
**Researched:** 2026-08-09
**Confidence:** MEDIUM

## Recommendation

Keep the implementation on the SDK's existing TypeScript/Web Platform foundation. Add exactly two direct runtime dependencies: `@msgpack/msgpack@^3.1.3` for MessagePack primitives and `@scure/base@^1.2.6` for bech32. Reuse `@noble/hashes@^1.8.0` for incremental SHA-256 and byte/hex utilities, and use `globalThis.crypto.subtle` for HKDF-SHA256 and AES-256-GCM. Expose large-file output as `ReadableStream<Uint8Array>` and a separate `Blob` convenience function.

Neither new package is itself the canonicalization layer. BUD-16 fixes bytes more tightly than generic MessagePack does, so the Hashtree module must own ordered wire DTO construction, UTF-8 bytewise comparison, integer/domain validation, decoder limits, and official-vector tests.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | Existing `^5.8.3`; target ES2022, NodeNext ESM | Public types and implementation | Preserves the package's build and runtime contract. Use `Uint8Array`, `Blob`, `ReadableStream`, callback types, and structural event types; do not introduce Node `Buffer` into Hashtree public APIs. **Confidence: HIGH** (repository evidence). |
| Web Crypto (`globalThis.crypto.subtle`) | Web platform API; Node 18+ | SHA-256, HKDF-SHA256, AES-256-GCM | Implements the exact BUD-15 primitives in browsers and Node without a Node-only import or crypto bundle. A 2 MiB BUD-17 chunk bounds each one-shot AES-GCM operation. Request a 256-bit key, use UTF-8 bytes for the fixed salt/info, a 12-byte zero IV, and the default 128-bit tag. **Confidence: MEDIUM** (official Node and MDN documentation, cross-checked against BUD-15). |
| WHATWG Streams | Global in Node 18 and modern browsers | Portable, backpressure-aware file reads | `ReadableStream<Uint8Array>` is the common browser/Node contract and composes with `Response`, `Blob.stream()`, and async iteration. Yield only after ciphertext-hash verification, authenticated decryption, and plaintext-key verification. **Confidence: MEDIUM** (official Node documentation). |
| Package `exports` subpath | Existing package mechanism | Isolated `blossom-client-sdk/hashtree` entry | Add `./hashtree` pointing to `lib/hashtree/index.js` and declarations. Do not import or re-export it from `src/index.ts`, `src/helpers/index.ts`, or `src/actions.ts`; root consumers then do not pull Hashtree code into normal ESM module graphs. **Confidence: HIGH** (repository architecture). |

### Runtime Dependencies

| Library | Version | Purpose | When and How to Use |
|---------|---------|---------|---------------------|
| `@msgpack/msgpack` | `^3.1.3` (current 3.x; Node >=18) | MessagePack binary encoder/decoder | Use only behind internal `encodeNode`/`decodeNode` adapters. Encode protocol-normalized plain objects with `sortKeys: false`; set keys in exact BUD order. Its numeric encoder uses shortest integer forms for safe integers and `Uint8Array` maps to MessagePack `bin`. Decode to `unknown` with strict `max*Length`/depth policy, then validate every shape and reject extensions, floats, unsafe/negative sizes, extra root fields, and unsupported types. **Confidence: MEDIUM** (official package docs/source plus draft vectors). |
| `@scure/base` | `^1.2.6` (intentionally 1.x) | bech32 word conversion and checksum for `npub`/`nhash` | Use `bech32.toWords/fromWords` and encode/decode with an explicit SDK length limit. The package default is BIP-173's 90 characters, but keyed `nhash` payloads exceed it. Parse and validate BUD-18 TLV in SDK code; accept the specified legacy raw 32-byte payload only. `@scure/base` is dependency-free, audited, and tree-shakeable. **Confidence: MEDIUM** (official source/README and npm metadata). |
| `@noble/hashes` | Existing `^1.8.0` | Incremental SHA-256, byte comparison, hex conversion | Reuse the installed dependency for streaming/chunk hashing and environments where one-shot WebCrypto digest would force a full extra buffer. Keep HKDF in WebCrypto so AES key material can remain a non-extractable `CryptoKey`; avoid a second hash package. **Confidence: HIGH** (repository evidence and package metadata). |

### Protocol-Owned Utilities (No Additional Package)

| Utility | Purpose | Required Rule |
|---------|---------|---------------|
| Canonical node normalizer | Construct exact MessagePack wire objects | Root keys `l,t`; link keys `h,k,m,n,s,t`, omitting absent fields; metadata keys sorted by encoded UTF-8 bytes; directory entries sorted by encoded UTF-8 name bytes. Never rely on JavaScript object input order from callers. |
| TLV codec | Encode/decode `nhash` payload | One-byte type and length, exactly one type `0` of 32 bytes, at most one type `5` of 32 bytes, reject malformed/duplicate required records, and preserve no unrecognized records when re-encoding canonical output. |
| CHK adapter | Implement BUD-15 | Always verify `SHA256(ciphertext) === blob_hash` before decrypt and `SHA256(plaintext) === chk_key` afterward. A zero IV is valid only with the content-derived key; never expose a lower-level “encrypt arbitrary key with zero IV” API. |
| Stream assembler | Traverse BUD-17 file nodes | Fetch in manifest order, bound recursion and bytes, verify each object before enqueue, honor cancellation/abort, and keep the `Blob` collector separate so streaming users do not buffer the whole file. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest `^3.1.3` | Unit, vector, malformed-input, and cross-runtime tests | Turn every BUD vector into exact hex assertions. Add Unicode metadata/name fixtures that differ under UTF-16 versus UTF-8 ordering, keyed `nhash` longer than 90 characters, GCM tamper tests, fanout bounds, cancellation, and multi-chunk memory tests. |
| Vitest browser + Playwright | Browser crypto/stream verification | Run the browser suite for WebCrypto, `ReadableStream`, `Blob`, abort, and bundle-entry behavior; Node-only tests are insufficient. |
| TypeScript build + package export smoke tests | Declaration and isolation verification | Test direct import from `blossom-client-sdk/hashtree`; also bundle/import the root and assert it has no Hashtree exports or module edges. `sideEffects: false` may be added only after verifying all package modules are side-effect free. |
| Changesets | Published API release | This is new published behavior, so include a minor changeset unless release policy says otherwise. |

## Installation

```bash
# Runtime dependencies; keep the Node-18-compatible scure major
pnpm add @msgpack/msgpack@^3.1.3 @scure/base@^1.2.6

# Already present and reused
# @noble/hashes@^1.8.0
```

Add the opt-in export without touching the root barrel:

```json
{
  "exports": {
    "./hashtree": {
      "import": "./lib/hashtree/index.js",
      "types": "./lib/hashtree/index.d.ts"
    }
  }
}
```

Dependencies are installed package-wide by npm/pnpm; export isolation controls runtime and bundle reachability, not installation size. Keep all imports of `@msgpack/msgpack` and `@scure/base` inside `src/hashtree/**` so existing root import graphs remain unchanged.

## Canonical Byte Risk Register

| Risk | Why It Changes Hashes | Prescriptive Control |
|------|-----------------------|----------------------|
| Using `@msgpack/msgpack` `sortKeys: true` | Version 3.1.3 calls JavaScript `keys.sort()`, which is UTF-16 code-unit order, while BUD-16 requires UTF-8 bytewise order. | Sort names and metadata keys with a shared `TextEncoder` byte comparator, build a new insertion-ordered object, and encode with `sortKeys: false`. Test non-ASCII and astral characters. |
| Passing arbitrary caller objects to `encode()` | Caller insertion order, extra keys, `undefined`, floats, `Date`, extension types, or unsafe integers can create noncanonical or invalid bytes. | Validate into closed protocol DTOs first; explicitly assign fields in BUD order and reject values outside the schema. Do not set `ignoreUndefined` as a substitute for normalization. |
| Number semantics | Sizes beyond JavaScript's safe integer range cannot be represented exactly; toggling `useBigInt64` changes encodings and decoded types. | Require non-negative safe integers, leave `useBigInt64: false`, and enforce configured total-size limits well below `Number.MAX_SAFE_INTEGER`. |
| Bech32 default length | `@scure/base` defaults to 90 characters, while an `nhash` carrying hash plus key TLVs is longer. Disabling all limits creates a DoS surface. | Pass a calculated BUD-18 maximum to encode/decode (rather than unlimited input), then enforce HRP, case, payload, TLV count, and exact lengths. |
| AES-GCM tag/IV mismatch | A different IV, tag length, output layout, or text encoding fails vectors and changes ciphertext hashes. | Use `iv = new Uint8Array(12)`, `tagLength: 128`, WebCrypto's `ciphertext || tag` result, and `TextEncoder` for exact ASCII salt/info. Assert official empty and `hello` vectors in Node and browser. |
| Hashing before/after wrong transform | Blossom addresses ciphertext, while `chk_key` addresses plaintext. | Name APIs/types distinctly (`plaintextHash`/`chkKey`, `ciphertextHash`/`blobHash`) and perform both required checks during reads. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@msgpack/msgpack@3.1.3` plus strict adapter | Hand-written minimal MessagePack codec | Consider only if vector tests reveal an unfixable encoder behavior or bundle measurements prove the dependency unacceptable. A custom decoder materially increases malformed-input and maintenance risk. |
| Native WebCrypto | `@noble/ciphers` + `@noble/hashes/hkdf` | Use only as an explicitly researched fallback if supported runtimes include environments without `crypto.subtle`. It adds code and creates a second crypto path that must pass all vectors and tamper tests. The current Node 18+/modern-browser contract does not justify it. |
| `@scure/base@1.2.6` | Local bech32 implementation | A local implementation is reasonable only under a strict zero-new-dependencies policy and would need BIP-173 property/vector testing. The audited dependency is lower risk. |
| `ReadableStream<Uint8Array>` | `AsyncIterable<Uint8Array>` as the only API | Offer an async-iterable adapter for functional composition, but do not make it the sole public stream because fetch/browser consumers naturally use WHATWG streams. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `msgpack-lite`, `notepack.io`, or JSON/CBOR | They are not the chosen current universal TypeScript implementation, or they emit a different wire format. BUD hashes are over exact MessagePack bytes. | `@msgpack/msgpack@3.1.3` behind the canonical adapter. |
| `@msgpack/msgpack` `sortKeys: true` | Its UTF-16 sorting does not implement the draft's UTF-8 byte order for all strings. | Protocol-owned byte comparator and ordered DTO construction. |
| `@scure/base@2.x` | Current 2.x metadata requires Node >=20.19, violating the SDK's Node 18 contract. | Stay on compatible `^1.2.6` until the SDK drops Node 18, then reassess. |
| Runtime `nostr-tools` dependency | Pulls relay/signing policy into the module and undermines callback injection and tree-shaking. | Structural event types plus caller-supplied query, publish, subscribe, sign, and NIP-44 callbacks. `@scure/base` handles only low-level bech32. |
| Node `crypto`, `stream`, or `Buffer` in public/core code | Creates browser bundler shims and splits runtime behavior. | `globalThis.crypto.subtle`, `ReadableStream`, `Uint8Array`, and `Blob`. |
| Whole-file `arrayBuffer()` as the large-file path | Defeats BUD-17's chunking and can duplicate large allocations. | Incremental chunk upload/read and an opt-in `Blob` collector. |
| Generic canonical MessagePack claims | Generic canonical modes do not automatically match BUD field order and UTF-8 ordering. | Treat BUD vectors as the normative byte contract. |

## Stack Patterns by Variant

**For a small plaintext object (<= 2 MiB):**
- Hash and upload the raw bytes; a file manifest is optional.
- Avoid encryption and manifest dependencies unless the caller requested them.

**For encrypted or large files:**
- Slice plaintext into canonical 2 MiB chunks.
- Hash each plaintext chunk, derive its own AES key, encrypt with WebCrypto, hash ciphertext, upload, then build at most 174 links per manifest node.
- Stream verified plaintext chunks to readers; collect them into a `Blob` only in the convenience API.

**For mutable/private roots:**
- Keep kind `30064` selection and NIP-44 operations behind injected callbacks.
- Keep link keys, root keys, and `k` query values out of all Blossom requests and error/log payloads.

## Version Compatibility

| Package/API | Compatible With | Notes |
|-------------|-----------------|-------|
| `@msgpack/msgpack@3.1.3` | Node >=18; major browsers; TypeScript 5.8 | Official docs list Node 18 and browser CI. Keep `skipLibCheck` and current DOM types; verify the repo's ES2022 build before merging. |
| `@scure/base@1.2.6` | Node 18 and browsers; ESM/CJS | Direct-import 1.x even if transitive versions exist. Do not allow an automated major upgrade to 2.x under the current engine floor. |
| `@noble/hashes@1.8.0` | Node 16+ and browsers | Already a runtime dependency. Prefer subpath imports such as `@noble/hashes/sha2` and `@noble/hashes/utils`. |
| WebCrypto | Modern browsers; Node 18 supported line | Requires a secure browser context. Feature-detect `globalThis.crypto?.subtle` and throw a clear unsupported-runtime error; do not silently change algorithms. |
| WHATWG `ReadableStream` | Global in Node 18 and modern browsers | Keep `node:stream/web` out of the portable module. Preserve `AbortSignal` cancellation through fetch, traversal, and stream cancellation. |

## Isolation and Tree-Shaking Contract

1. Put all new implementation under `src/hashtree/**` with a single `src/hashtree/index.ts` public barrel.
2. Add only the `./hashtree` package export. Do not add a root re-export and do not make existing actions import Hashtree types at runtime.
3. Keep protocol types in the Hashtree subtree; use `import type` across client/functional boundaries to prevent accidental runtime edges.
4. Keep Nostr and NIP-44 adapters callback-only. Do not add `nostr-tools` as a runtime or peer requirement for the subpath.
5. Test isolation with an ESM module-graph/bundler smoke test. `package.json` exports alone do not guarantee tree-shaking if root modules import the submodule.

## Sources

- [BUD-15 draft PR 104](https://github.com/hzrd149/blossom/pull/104) and [draft source](https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md) — CHK algorithm, integrity rules, and vectors. **MEDIUM** (primary draft; confidence seam classifies verified websearch as MEDIUM).
- [BUD-16 draft PR 105](https://github.com/hzrd149/blossom/pull/105) and [draft source](https://github.com/hzrd149/blossom/blob/1b2f140b0d3fd06a907b159d7628e1d007588da3/buds/16.md) — MessagePack field/order rules and vectors. **MEDIUM**.
- [BUD-17 draft PR 106](https://github.com/hzrd149/blossom/pull/106) and [draft source](https://github.com/hzrd149/blossom/blob/1848f77c4a25b70d10a3963d66ba1c8aba1e4f2c/buds/17.md) — chunk size, link limits, fanout, and safety validation. **MEDIUM**.
- [BUD-18 draft PR 107](https://github.com/hzrd149/blossom/pull/107) and [draft source](https://github.com/hzrd149/blossom/blob/018f3e32227cf8fd1fba8dff2d39d6e3370d2d52/buds/18.md) — `htree`, `nhash`, TLV, root events, and visibility modes. **MEDIUM**.
- [`@msgpack/msgpack` official documentation](https://github.com/msgpack/msgpack-javascript/tree/v3.1.3) and [v3.1.3 encoder source](https://github.com/msgpack/msgpack-javascript/blob/v3.1.3/src/Encoder.ts) — runtime support, options, binary/integer mapping, decoder bounds, and actual `sortKeys` behavior. **MEDIUM**.
- [`@scure/base` v1.2.6 official documentation/source](https://github.com/paulmillr/scure-base/tree/1.2.6) — bech32 API, default limit, audit, packaging, and dependency policy. **MEDIUM**.
- [Node Web Crypto documentation](https://nodejs.org/api/webcrypto.html) and [MDN HKDF `deriveKey`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) — supported HKDF/AES-GCM operations. **MEDIUM**.
- [Node Web Streams documentation](https://nodejs.org/api/webstreams.html) — Node 18 history and WHATWG stream behavior. **MEDIUM**.
- Local `package.json`, `tsconfig.json`, `.planning/codebase/STACK.md`, and `.planning/codebase/ARCHITECTURE.md` — existing engine, dependency, build, and export constraints. **HIGH**.

## Research Gaps / Phase Flags

- The BUDs are open drafts, so pin tests to their cited commit versions and re-check all four PR heads immediately before implementation and release.
- Run a small implementation spike that reproduces every published MessagePack and CHK vector with the recommended versions; the generic library documentation cannot prove BUD byte identity by itself.
- Confirm the intended maximum accepted `nhash` length from the final BUD-18 payload policy. Until specified, calculate a tight bound from supported TLVs instead of passing `false` for unbounded input.
- Measure root-import and Hashtree-subpath bundle graphs in at least one browser bundler; package export isolation is architecturally clear but bundle behavior is consumer-tool dependent.

---
*Stack research for: blossom-client-sdk Hashtree milestone*
*Researched: 2026-08-09*
