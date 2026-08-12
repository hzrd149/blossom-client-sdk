# Phase 2: BUD-15 CHK and Secret-Safe References - Research

**Researched:** 2026-08-12
**Domain:** Deterministic content-hash-key encryption, capability-bearing Blossom references, and secret-safe TypeScript APIs
**Confidence:** HIGH for repository architecture; MEDIUM for the still-open BUD-15 draft

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Functional crypto API

- **D-01:** The standalone encryption primitive returns only `{ ciphertext, key }`. Hashing and reference construction remain separate composable operations. — **Reversibility:** costly — Expanding the published result shape later changes the public functional contract and downstream expectations.
- **D-02:** The standalone decryption primitive receives explicit ciphertext bytes, key bytes, and the expected ciphertext hash. It does not accept or parse a URI.
- **D-03:** Low-level CHK keys and hashes use strict `Uint8Array` values; string encoding and decoding belong to reference helpers.
- **D-04:** Plaintext behavior and CHK encryption remain separate functional primitives rather than one mode-aware function.
- **D-05:** The future stateful class API accepts mode-aware options and defaults to plaintext. This phase may define the shared option contract, but does not implement the later client classes.

### Encrypted Blossom references

- **D-06:** Parsing an encrypted `blossom:` reference returns validated typed CHK fields, including the encryption mode and a decoded `Uint8Array` key, together with standard Blossom metadata. — **Reversibility:** costly — The parsed shape becomes a public capability-bearing contract used by callers.
- **D-07:** Unknown query parameters and repeated values are preserved through parsing and rebuilding for forward compatibility.
- **D-08:** Builders emit recognized parameters in a fixed documented order, followed by preserved extension parameters in deterministic key/value order.
- **D-09:** Security-sensitive `enc` and `k` parameters must each occur exactly once where required. Duplicate or conflicting values are validation errors; no first-value or last-value rule applies.

### Secret safety

- **D-10:** Ciphertext-address, GCM-authentication, and plaintext-CHK failures expose the same generic public integrity failure. Do not reveal the failed stage or attach underlying cryptographic causes.
- **D-11:** Parsed encrypted references are ordinary plain data objects whose key is enumerable. Document the entire object as capability-bearing and unsafe to log or serialize indiscriminately.
- **D-12:** Routine progress and diagnostic callbacks may receive public storage metadata such as operation, byte counts, ciphertext hash, and non-secret mode. They must never receive plaintext, keys, full encrypted URIs, or secret-bearing parsed objects.
- **D-13:** Never mutate caller-owned secret byte arrays. Copy when necessary and wipe internal derived-key buffers on a best-effort basis after use.

### the agent's Discretion

- Exact function and type names, provided they remain descriptive, standalone, and consistent with the Phase 1 public API decisions.
- Exact canonical query-parameter ordering, provided it is fixed, documented, and deterministic.
- Internal cryptographic helper structure and best-effort buffer-wiping mechanics, subject to exact BUD-15 bytes and browser/Node portability.

### Deferred Ideas (OUT OF SCOPE)

None — the stateful class mode preference was captured as a future API contract already required by CHK-06, while class implementation remains in its scheduled later phase.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                       | Research Support                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHK-01 | Consumer can deterministically encrypt plaintext using exact `chk-v1`                             | Exact byte algorithm, constants, output layout, and two official draft vectors are pinned below. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md]          |
| CHK-02 | Consumer can decrypt only after ciphertext hash, GCM authentication, and plaintext CHK validation | A fail-closed verification sequence and one indistinguishable public error contract are prescribed below. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md] |
| CHK-03 | Each encrypted file chunk derives its own key from its own plaintext                              | Per-call derivation is the primitive boundary; no file-level key parameter exists. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md]                        |
| CHK-04 | Consumer can parse/create `blossom:` references with valid `enc=chk-v1` and `k`                   | A strict, lossless parameter model and deterministic builder are specified below. [VERIFIED: codebase grep + BUD-10/BUD-15 drafts]                                                                             |
| CHK-05 | Secrets never reach servers, ordinary errors, progress, or diagnostics                            | Capability boundaries and negative leak tests are mapped below. [VERIFIED: CONTEXT.md decisions D-10–D-13]                                                                                                     |
| CHK-06 | Plaintext/encrypted modes are first-class, with plaintext client default                          | Publish a discriminated mode option contract now while retaining separate crypto primitives; stateful classes remain deferred. [VERIFIED: CONTEXT.md decisions D-04–D-05]                                      |

</phase_requirements>

## Summary

Implement this phase as three focused Hashtree modules: byte-level hashing/CHK crypto, strict capability-bearing Blossom references, and shared mode/diagnostic contracts. Keep all exports behind `blossom-client-sdk/hashtree`; never extend the root barrel. [VERIFIED: AGENTS.md, Phase 1 code, CONTEXT.md]

Pin protocol behavior to BUD-15 PR #104 head `ef6c7fb4435530556fb32345eec010505bda017a`, because BUD-15 is an open draft rather than merged Blossom text. Its exact construction is SHA-256 plaintext → HKDF-SHA256 → AES-256-GCM with a 12-byte zero nonce → ciphertext plus 16-byte tag → SHA-256 ciphertext address. [CITED: https://github.com/hzrd149/blossom/pull/104] The planner must treat a later draft-head change as a protocol review trigger. [ASSUMED]

Use the already-installed `@noble/hashes` for byte-oriented SHA-256 and HKDF, and Web Crypto `SubtleCrypto` for AES-GCM; this avoids a new dependency and fits the asynchronous portable API. [VERIFIED: package.json + official noble-hashes docs] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey] Browser tests must run under the existing Playwright job, while node tests cover vectors, tampering, ownership, and secret redaction. [VERIFIED: AGENTS.md + vitest.config.ts]

**Primary recommendation:** Plan two implementation slices—first exact CHK primitives and adversarial vectors, then lossless strict references plus secret-safe mode contracts—with build, node, browser, export, and isolation gates after each slice. [VERIFIED: codebase architecture]

## Architectural Responsibility Map

| Capability                                      | Primary Tier                   | Secondary Tier                  | Rationale                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHA-256/HKDF/AES-GCM                            | Portable library core          | Browser/Node Web Crypto runtime | Client-side bytes only; Blossom servers store opaque ciphertext. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md] |
| Encrypted `blossom:` reference parsing/building | Portable library core          | —                               | Parsing and encoding are local deterministic transformations. [VERIFIED: CONTEXT.md D-06–D-09]                                                                        |
| Capability redaction                            | Portable library API boundary  | Future storage adapters         | Errors/callback payloads are formed in the library; later adapters must receive only ciphertext metadata. [VERIFIED: CONTEXT.md D-10–D-12]                            |
| Ciphertext storage/request addressing           | Future API/storage integration | Blossom server                  | Phase 2 defines safe values, but network orchestration is Phase 6. [VERIFIED: ROADMAP.md]                                                                             |
| Stateful plaintext default                      | Future client tier             | Shared type contract            | Define the discriminated option now; class behavior belongs to Phase 8. [VERIFIED: CONTEXT.md D-05]                                                                   |

## Standard Stack

### Core

| Library/API               | Version                                           | Purpose                                | Why Standard                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@noble/hashes`           | repository range `^1.8.0`; installed API line 1.x | SHA-256, HKDF-SHA256, hex utilities    | Already a production dependency; official API accepts/returns `Uint8Array` and provides RFC 5869 HKDF. [VERIFIED: package.json + https://github.com/paulmillr/noble-hashes/tree/1.8.0]   |
| Web Crypto `SubtleCrypto` | platform API                                      | AES-256-GCM encrypt/decrypt            | Available in the intended browser API and Node Web Crypto; produces ciphertext with the GCM tag appended. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt] |
| TypeScript                | `^5.8.3`                                          | Strict ESM implementation/declarations | Existing compiler and NodeNext contract. [VERIFIED: package.json + tsconfig.json]                                                                                                        |
| Vitest + browser provider | `^3.1.3`                                          | Node and Chromium verification         | Existing test infrastructure and CI commands. [VERIFIED: package.json + AGENTS.md]                                                                                                       |

### Supporting

| Library/API       | Version      | Purpose                                                   | When to Use                                                                                                                                                           |
| ----------------- | ------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TextEncoder`     | Web platform | Exact UTF-8 bytes for `hashtree-chk` and `encryption-key` | Define constants once; never rely on implicit string conversion. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md] |
| `URLSearchParams` | Web platform | Percent decoding/encoding                                 | Use for query token mechanics, but explicitly retain entry pairs and validate singleton security fields. [VERIFIED: src/helpers/blossom-uri.ts]                       |

### Alternatives Considered

| Instead of                         | Could Use                           | Tradeoff                                                                                                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Crypto AES-GCM                 | `@noble/ciphers` pure JS AES-GCM    | More uniform sync behavior but adds a Hashtree-only dependency, root-graph denylist work, legitimacy checkpoint, and audit surface. Current release is flagged SUS by the seam solely because it is very new. [VERIFIED: npm registry + package-legitimacy seam] |
| Hashtree-specific reference module | Modify `src/helpers/blossom-uri.ts` | Risks changing the established root/helper API and exporting bearer-key shapes outside the isolated surface. [VERIFIED: CONTEXT.md integration guidance]                                                                                                         |

**Installation:** No package installation is required. [VERIFIED: package.json]

## Package Legitimacy Audit

No new external package is recommended. Existing `@noble/hashes` is already installed and officially documented; the seam reported `SUS` for the current registry latest because that release is under its age threshold, not because of postinstall, repository, or download signals. Do not upgrade it in this phase. [VERIFIED: npm registry + package-legitimacy seam]

| Package          | Registry | Age                                              | Downloads                       | Source Repo                        | Verdict              | Disposition                                                   |
| ---------------- | -------- | ------------------------------------------------ | ------------------------------- | ---------------------------------- | -------------------- | ------------------------------------------------------------- |
| `@noble/hashes`  | npm      | created 2021; repository currently pins `^1.8.0` | ~70.8M/week observed 2026-08-12 | github.com/paulmillr/noble-hashes  | SUS (latest too new) | Existing dependency only; no upgrade [VERIFIED: npm registry] |
| `@noble/ciphers` | npm      | created 2023                                     | ~25.5M/week observed 2026-08-12 | github.com/paulmillr/noble-ciphers | SUS (latest too new) | Not installed; alternative rejected [VERIFIED: npm registry]  |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: package-legitimacy seam]
**Packages flagged as suspicious [SUS]:** `@noble/hashes` latest and `@noble/ciphers` latest; neither should be newly installed by this phase. [VERIFIED: package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
plaintext Uint8Array
  -> copy caller bytes
  -> SHA-256 = chk_key
  -> HKDF-SHA256(salt="hashtree-chk", info="encryption-key", 32 bytes)
  -> AES-256-GCM(zero nonce, 128-bit tag)
  -> ciphertext Uint8Array -----------------> SHA-256 -> public blob hash
                         |                                  |
                         +------ ordinary Blossom blob -----+

encrypted reference string
  -> strict scheme/hash/ext parser
  -> ordered query entry list
  -> singleton validation(enc, k)
  -> decoded key copy + public metadata + preserved extensions
  -> deterministic builder (recognized order, then sorted extensions)

decrypt(ciphertext, key, expectedCiphertextHash)
  -> ciphertext hash match? --no--> generic HashtreeIntegrityError
  -> AES-GCM auth success?   --no--> same generic HashtreeIntegrityError
  -> plaintext hash == key?  --no--> same generic HashtreeIntegrityError
  -> plaintext copy
```

All arrows and failure ordering above are protocol- or decision-derived. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md] [VERIFIED: CONTEXT.md]

### Recommended Project Structure

```text
src/hashtree/
├── chk.ts                 # hash, derive, encrypt, decrypt; no URI or network logic
├── blossom-reference.ts   # isolated strict/lossless capability references
├── types.ts               # shared mode and safe diagnostic/progress contracts
└── index.ts               # curated exports only
tests/hashtree/
├── chk.test.ts            # vectors, determinism, tampering, ownership
├── blossom-reference.test.ts
├── secret-safety.test.ts
└── exports.test.ts        # update public runtime/type surface and declarations
```

This preserves focused wildcard-public modules and the Phase 1 isolation boundary. [VERIFIED: Phase 1 CONTEXT.md D-04/D-13/D-14]

### Pattern 1: Exact byte pipeline with one public failure

**What:** Copy inputs, validate fixed lengths, compute and compare hashes before/after authenticated decryption, and translate every integrity-stage failure to a fresh generic `HashtreeIntegrityError` with no cause. [VERIFIED: CONTEXT.md D-10/D-13]

**When to use:** Every CHK decrypt call and later every remotely fetched encrypted object. [CITED: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md]

```typescript
// Source: BUD-15 PR #104 + locked Phase 2 decisions (illustrative names)
export async function decryptChk(
  ciphertextInput: Uint8Array,
  keyInput: Uint8Array,
  expectedCiphertextHashInput: Uint8Array,
): Promise<Uint8Array> {
  const ciphertext = ciphertextInput.slice();
  const key = keyInput.slice();
  const expectedHash = expectedCiphertextHashInput.slice();
  try {
    if (!equalBytes(sha256(ciphertext), expectedHash)) throw new Error();
    const plaintext = await aesGcmDecrypt(ciphertext, deriveAesKey(key));
    if (!equalBytes(sha256(plaintext), key)) throw new Error();
    return plaintext;
  } catch {
    throw new HashtreeIntegrityError("Hashtree content failed integrity verification");
  } finally {
    key.fill(0);
  }
}
```

The implementation should avoid throwing stage-specific messages inside the public catch boundary so later refactors cannot accidentally leak them. [ASSUMED]

### Pattern 2: Lossless query multimap plus typed recognized fields

**What:** Retain query entries as ordered key/value pairs during parse; extract recognized public metadata; require exactly one `enc` and `k` for encrypted form; decode `k` only after exact lowercase-hex validation; preserve every unrecognized occurrence. [VERIFIED: CONTEXT.md D-06–D-09]

**When to use:** Encrypted `blossom:` parse/build and later manifest references.

Canonical builder order recommendation: `enc`, `k`, `xs` (input order), `as` (input order), `sz`, then extension pairs sorted lexicographically by decoded key and value with original order as the stable tie-breaker. [ASSUMED] This keeps security fields adjacent and deterministic while preserving duplicate unknown values. [ASSUMED]

### Pattern 3: Discriminated mode contract, separate primitives

```typescript
// Source: locked decisions D-04/D-05 (illustrative names)
export type HashtreeMode = "plaintext" | "chk-v1";
export type HashtreeModeOptions = { readonly mode?: "plaintext" } | { readonly mode: "chk-v1" };
```

Do not add a mode-aware `encryptOrPassThrough()` function. The type exists so later clients can default absent mode to plaintext, while functional callers explicitly invoke plaintext hashing or CHK encryption. [VERIFIED: CONTEXT.md D-04/D-05]

### Anti-Patterns to Avoid

- **Random nonce or serialized nonce:** Changes BUD-15 bytes and breaks determinism. [CITED: BUD-15 PR #104]
- **Caller-supplied/file-level AES key:** Reuses `(key, zero nonce)` across different plaintext chunks and breaks the construction. [CITED: https://github.com/hzrd149/blossom/issues/104#issuecomment-2950870328]
- **Decrypt before ciphertext-address validation:** Violates required ordering and processes unauthenticated-address data unnecessarily. [CITED: BUD-15 PR #104]
- **Pass full URI/parsed reference into callbacks:** The URI/object contains a bearer key. [VERIFIED: CONTEXT.md D-11/D-12]
- **Spread arbitrary error context or attach crypto cause:** Can retain ciphertext, keys, parsed objects, or stage identity. [VERIFIED: src/hashtree/errors.ts + CONTEXT.md D-10]
- **Use plain object/map for extension parameters:** Collapses repeats and loses ordering. [VERIFIED: CONTEXT.md D-07]
- **Extend root helpers/root barrel:** Violates Hashtree opt-in isolation. [VERIFIED: Phase 1 contracts]

## Don't Hand-Roll

| Problem                     | Don't Build                                     | Use Instead                                                                             | Why                                                                                                                                                                        |
| --------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHA-256/HKDF                | Custom digest/KDF                               | Existing `@noble/hashes` APIs                                                           | Exact, byte-oriented audited primitives already exist. [CITED: https://github.com/paulmillr/noble-hashes/tree/1.8.0]                                                       |
| AES-GCM                     | AES, GHASH, or tag concatenation implementation | `SubtleCrypto.encrypt/decrypt` with `{name: "AES-GCM", iv: ZERO_NONCE, tagLength: 128}` | Cryptographic primitives and authentication failure handling are platform responsibilities. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt] |
| Query percent encoding      | Manual split/replace codec                      | `URLSearchParams` entry iteration plus explicit policy                                  | Handles percent encoding while the wrapper enforces duplicates/preservation. [VERIFIED: src/helpers/blossom-uri.ts]                                                        |
| Secret-safe error hierarchy | New error codes/context bags                    | Existing `HashtreeValidationError` and `HashtreeIntegrityError`                         | Phase 1 made class identity and narrow safe fields the public contract. [VERIFIED: src/hashtree/errors.ts]                                                                 |

**Key insight:** The custom work is protocol composition and boundary enforcement, not cryptographic primitives or generic URI tokenization. [VERIFIED: BUD-15 + codebase]

## Common Pitfalls

### Pitfall 1: Wrong HKDF/string bytes

**What goes wrong:** Vectors do not match. **Why:** Salt/info are exact UTF-8 strings, not hex, NUL-terminated text, or swapped parameters. **Avoid:** Module-level encoded constants and official vectors. **Warning:** Empty or `hello` ciphertext differs. [CITED: BUD-15 PR #104]

### Pitfall 2: GCM tag layout mismatch

**What goes wrong:** Cross-runtime decryption fails or blob hashes differ. **Why:** BUD-15 stores ciphertext immediately followed by the 16-byte tag; Web Crypto returns this combined form when `tagLength: 128`. **Avoid:** Assert output length equals plaintext length + 16, including empty plaintext. [CITED: BUD-15 PR #104] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt]

### Pitfall 3: Non-constant-time hash comparison

**What goes wrong:** Equality checks can expose mismatch position. **Why:** naive loops return early. **Avoid:** fixed-length full-loop XOR accumulation after exact 32-byte length validation. [ASSUMED] Web Crypto does not provide a portable timing-safe byte comparison API. [ASSUMED]

### Pitfall 4: Secret aliasing

**What goes wrong:** Caller key arrays are wiped/mutated, or returned arrays alias scratch storage. **Why:** `Uint8Array` views share buffers. **Avoid:** `.slice()` at public boundaries; wipe only owned derived/scratch arrays in `finally`. **Warning:** mutation tests change caller fixtures after calls. [VERIFIED: CONTEXT.md D-13]

### Pitfall 5: “Redaction” only in messages

**What goes wrong:** secrets remain in `.cause`, enumerable properties, callback objects, snapshots, or serialized diagnostics. **Why:** tests inspect only `message`. **Avoid:** recursively inspect public errors/callback payload values and JSON output for key/plaintext/full-URI sentinels. [VERIFIED: CONTEXT.md D-10–D-12]

### Pitfall 6: BUD draft drift

**What goes wrong:** implementation matches a reviewed but no-longer-current commit. **Why:** PR #104 is open. **Avoid:** pin SHA in tests/docs and re-check PR head during planning/execution. [CITED: https://github.com/hzrd149/blossom/pull/104]

## Code Examples

### Exact derivation constants

```typescript
// Source: https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";

const encoder = new TextEncoder();
const CHK_SALT = encoder.encode("hashtree-chk");
const CHK_INFO = encoder.encode("encryption-key");
const ZERO_NONCE = new Uint8Array(12);

function deriveAesKey(chkKey: Uint8Array): Uint8Array {
  return hkdf(sha256, chkKey, CHK_SALT, CHK_INFO, 32);
}
```

Use the repository's installed v1.8 export spellings verified by `pnpm build`; do not copy `.js` suffixes from the v2 README without checking the installed package exports. [VERIFIED: current src/helpers/blob.ts + installed dependency line]

### Web Crypto AES-GCM

```typescript
// Source: MDN SubtleCrypto AES-GCM docs; constants fixed by BUD-15
async function encryptAesGcm(plaintext: Uint8Array, rawKey: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const result = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ZERO_NONCE, tagLength: 128 }, key, plaintext);
  return new Uint8Array(result);
}
```

### Official draft vector assertions

```typescript
// Source: BUD-15 PR #104 head ef6c7fb
expect(hex(encryptChk(new Uint8Array()).key)).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
expect(hex(encryptChk(new TextEncoder().encode("hello")).ciphertext)).toBe(
  "c65308d9c8649ff1c59820d0b3a030db34ad00f92d",
);
```

## State of the Art

| Old Approach                                               | Current Approach                                                                   | When Changed              | Impact                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| BUD-10 plain Blossom reference metadata                    | Draft BUD-15 adds `enc=chk-v1` and bearer `k`                                      | PR #104 opened 2026-06-06 | Reference parsing becomes capability-bearing. [CITED: PR #104]                                                             |
| Early BUD-15 text tied `sz` to ciphertext/plaintext length | Current head removes CHK-specific `sz`; BUD-10 meaning remains addressed-blob size | PR update 2026-06-15      | Do not require or reinterpret `sz` for CHK. [CITED: https://github.com/hzrd149/blossom/issues/104#issuecomment-2950984938] |
| Implicit chunk guidance                                    | Current head explicitly requires per-chunk plaintext-derived keys                  | PR update 2026-06-15      | CHK-03 must be an invariant/test, not documentation only. [CITED: PR #104 discussion]                                      |

**Deprecated/outdated:** Any copied BUD-15 draft that requires `sz` for CHK or derives plaintext size as `sz - 16` is superseded by pinned head `ef6c7fb`. [CITED: PR #104 discussion]

## Assumptions Log

| #   | Claim                                                                                 | Section          | Risk if Wrong                                                                         |
| --- | ------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| A1  | Re-checking PR head should be a planning/execution gate.                              | Summary/Pitfalls | Low; omitting it risks silent draft drift.                                            |
| A2  | Generic integrity implementation should avoid stage-specific internal throw messages. | Architecture     | Low; alternative can still satisfy public error contract if thoroughly tested.        |
| A3  | Canonical recognized order should be `enc,k,xs,as,sz`, then sorted extensions.        | Architecture     | Medium; this is a published canonicalization choice and should be locked in the plan. |
| A4  | Fixed-length XOR accumulation is the portable comparison strategy.                    | Pitfalls         | Low; a proven portable constant-time helper could replace it.                         |

## Open Questions

1. **Which canonical recognized parameter order should become public?**

   - What we know: D-08 requires a documented fixed order; BUD-10/BUD-15 do not prescribe one. [VERIFIED: CONTEXT.md + drafts]
   - What's unclear: Exact public ordering.
   - Recommendation: Lock `enc,k,xs,as,sz`, then lexicographically sorted extension pairs, before implementation. [ASSUMED]

2. **Should parsing accept a plaintext reference with a lone unknown `enc` value?**
   - What we know: `k` requires `enc=chk-v1`; D-09 makes recognized `enc` security-sensitive. [CITED: BUD-15] [VERIFIED: CONTEXT.md]
   - What's unclear: Whether unsupported future `enc` is preserved as an extension or rejected as unsupported encryption.
   - Recommendation: Reject any recognized `enc` value other than exactly one `chk-v1`; unknown parameters are preserved, unknown modes are not silently plaintext. [ASSUMED]

## Environment Availability

| Dependency          | Required By          | Available                                            | Version                      | Fallback                                                                   |
| ------------------- | -------------------- | ---------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Node.js             | node tests/build     | ✓                                                    | 22.23.1 locally; CI 18/20/22 | CI matrix is authoritative [VERIFIED: environment + AGENTS.md]             |
| pnpm                | scripts              | ✓                                                    | 10.10.0                      | — [VERIFIED: environment]                                                  |
| Chromium/Playwright | browser crypto tests | package present; browser installation not probed     | Playwright `^1.52.0`         | `pnpm exec playwright install` per CI [VERIFIED: package.json + AGENTS.md] |
| Web Crypto          | AES-GCM              | ✓ in current Node; browser verified by browser suite | platform                     | No package fallback recommended [VERIFIED: environment + MDN]              |

**Missing dependencies with no fallback:** none identified. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property          | Value                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | Vitest `^3.1.3` with `@vitest/browser` and Playwright [VERIFIED: package.json]                                                                           |
| Config file       | `vitest.config.ts` [VERIFIED: codebase]                                                                                                                  |
| Quick run command | `pnpm vitest run tests/hashtree/chk.test.ts tests/hashtree/blossom-reference.test.ts tests/hashtree/secret-safety.test.ts` [VERIFIED: AGENTS.md pattern] |
| Browser command   | `pnpm vitest run --browser --browser.headless tests/hashtree/chk.test.ts tests/hashtree/blossom-reference.test.ts` [VERIFIED: AGENTS.md]                 |
| Full suite        | `pnpm test && pnpm build` [VERIFIED: AGENTS.md]                                                                                                          |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                                    | Test Type               | Automated Command                        | File Exists?                  |
| ------ | ------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- | ----------------------------- |
| CHK-01 | empty/hello exact vectors; repeat determinism                                               | node + browser          | focused CHK command above                | ❌ Wave 0                     |
| CHK-02 | ciphertext hash, tag/ciphertext, wrong key, plaintext-key mismatch all reject identically   | adversarial unit        | focused CHK command                      | ❌ Wave 0                     |
| CHK-03 | two distinct chunks derive independent keys; identical chunks deduplicate                   | unit                    | focused CHK command                      | ❌ Wave 0                     |
| CHK-04 | valid/invalid/duplicate refs; lossless unknown repeats; canonical build                     | unit + browser          | focused reference command                | ❌ Wave 0                     |
| CHK-05 | caller bytes unchanged; errors/callbacks contain no sentinels; no request integration added | adversarial unit/static | focused safety command + isolation tests | ❌ Wave 0                     |
| CHK-06 | mode types accept plaintext default contract and encrypted discriminator                    | type/runtime export     | exports test + build                     | Existing file needs extension |

### Sampling Rate

- **Per task commit:** focused relevant test file plus `pnpm build`. [VERIFIED: repository commands]
- **Per wave merge:** `pnpm test && pnpm vitest run --browser --browser.headless && pnpm build`. [VERIFIED: AGENTS.md]
- **Phase gate:** Full node/browser suites, build, Phase 1 isolation/package tests, and pinned vectors green. [VERIFIED: Phase 1 contracts]

### Wave 0 Gaps

- [ ] `tests/hashtree/chk.test.ts` — CHK-01/02/03 vectors and tampering
- [ ] `tests/hashtree/blossom-reference.test.ts` — CHK-04 parsing/canonicalization
- [ ] `tests/hashtree/secret-safety.test.ts` — CHK-05 ownership/leak assertions
- [ ] Extend `tests/hashtree/exports.test.ts` and isolation exclusive-dependency list if dependencies change

## Security Domain

### Applicable ASVS Categories

| ASVS Category                 | Applies                    | Standard Control                                                                                                                 |
| ----------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication             | no                         | No identity/authentication in this phase. [VERIFIED: phase boundary]                                                             |
| V3 Session Management         | no                         | No sessions. [VERIFIED: phase boundary]                                                                                          |
| V4 Access Control             | yes, capability possession | Treat `k` and parsed encrypted references as bearer capabilities; never forward/log them. [VERIFIED: CONTEXT.md]                 |
| V5 Input Validation           | yes                        | Strict scheme/hash/ext/query cardinality, lowercase hex, byte lengths, and positive `sz`. [VERIFIED: BUD-10/BUD-15 + CONTEXT.md] |
| V6 Cryptography               | yes                        | SHA-256, HKDF-SHA256, AES-256-GCM through established primitives; exact pinned vectors. [CITED: BUD-15]                          |
| V7 Error Handling and Logging | yes                        | One cause-free integrity error; secret-negative callback/serialization tests. [VERIFIED: CONTEXT.md D-10–D-12]                   |

### Known Threat Patterns for TypeScript/Web Crypto

| Pattern                                           | STRIDE                           | Standard Mitigation                                                                                                               |
| ------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Reused key with fixed nonce                       | Information disclosure/Tampering | Derive key from each exact plaintext/chunk; expose no arbitrary-key encrypt API. [CITED: PR #104 discussion]                      |
| Ciphertext substitution                           | Tampering                        | Verify expected ciphertext hash before GCM. [CITED: BUD-15]                                                                       |
| Non-key-committing GCM ambiguity                  | Tampering                        | Verify plaintext SHA-256 equals CHK key after GCM. [CITED: PR #104 discussion]                                                    |
| Capability leakage through URI/error/callback     | Information disclosure           | Narrow types, no full URI/parsed object payloads, cause-free integrity errors, negative sentinel tests. [VERIFIED: CONTEXT.md]    |
| Duplicate `enc`/`k` parameter confusion           | Spoofing/Tampering               | Exact singleton cardinality; reject duplicate or conflicting occurrences. [VERIFIED: CONTEXT.md D-09]                             |
| Guessable plaintext confirmation/equality leakage | Information disclosure           | Document CHK limitation; do not market it for low-entropy secrets or equality-sensitive content. [CITED: BUD-15 Security section] |

## Project Constraints (from AGENTS.md)

- Keep this a single-package TypeScript NodeNext ESM library; build output is `lib/` via `pnpm build`. [VERIFIED: AGENTS.md]
- Export Hashtree symbols only from focused `src/hashtree/*` modules and `src/hashtree/index.ts`; do not flatten them onto `src/index.ts`. [VERIFIED: AGENTS.md + Phase 1]
- Use `.js` relative specifiers and preserve declaration emission. [VERIFIED: codebase/tsconfig]
- Run `pnpm test`; use the focused Vitest command during iteration; run the browser suite for browser-facing crypto behavior. [VERIFIED: AGENTS.md]
- Preserve Node 18/20/22 compatibility and run build verification. [VERIFIED: AGENTS.md]
- Format with Prettier (2 spaces, print width 120); there is no lint script. [VERIFIED: AGENTS.md]
- Add a Changeset for published behavior unless explicitly declined; Phase 1 already added the milestone minor Changeset, so planning should inspect whether amending/adding another is appropriate rather than duplicating blindly. [VERIFIED: AGENTS.md + git/codebase]

## Sources

### Primary (HIGH confidence repository facts)

- `AGENTS.md`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/hashtree/*`, `src/helpers/blossom-uri.ts` — package, API, portability, and testing constraints. [VERIFIED: codebase grep]
- Phase 1 context/research/implementation and Phase 2 CONTEXT.md — locked architecture and safety decisions. [VERIFIED: planning artifacts]

### Secondary (MEDIUM confidence protocol/platform)

- [BUD-15 PR #104 pinned head](https://github.com/hzrd149/blossom/blob/ef6c7fb4435530556fb32345eec010505bda017a/buds/15.md) — exact draft algorithm, safety rules, URI parameters, vectors. [CITED]
- [BUD-15 PR discussion](https://github.com/hzrd149/blossom/pull/104) — draft status and June 15 hardening changes. [CITED]
- [BUD-10](https://github.com/hzrd149/blossom/blob/master/buds/10.md) — base Blossom URI grammar and standard metadata. [CITED]
- [MDN SubtleCrypto deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) and [encrypt](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) — HKDF/AES-GCM Web Crypto API. [CITED]
- [noble-hashes 1.8 README](https://github.com/paulmillr/noble-hashes/tree/1.8.0) — byte hash/HKDF APIs. [CITED]

### Tertiary (LOW confidence)

- Canonical parameter order and unknown-encryption rejection recommendations are project-policy choices tagged `[ASSUMED]`, not claims from the BUD drafts.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — relies primarily on installed stack and platform API already targeted by the project. [VERIFIED: codebase]
- Architecture: HIGH — dominated by locked Phase 1/2 decisions. [VERIFIED: CONTEXT.md]
- Protocol bytes: MEDIUM — exact and vector-backed, but the authoritative PR is still open. [CITED: PR #104]
- Pitfalls/security: MEDIUM-HIGH — protocol discussion plus locked secret-safety decisions. [CITED: PR #104] [VERIFIED: CONTEXT.md]

**Research date:** 2026-08-12
**Valid until:** 2026-08-19 because the protocol source is an open draft PR. [ASSUMED]
