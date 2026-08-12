# Phase 2: BUD-15 CHK and Secret-Safe References - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hashtree/chk.ts` | utility/service | transform | `src/helpers/blob.ts` | role-match |
| `src/hashtree/blossom-reference.ts` | utility/model | transform | `src/helpers/blossom-uri.ts` | exact |
| `src/hashtree/types.ts` | model | event-driven | `src/hashtree/types.ts` | exact (modify) |
| `src/hashtree/index.ts` | config/barrel | request-response export surface | `src/hashtree/index.ts` | exact (modify) |
| `tests/hashtree/chk.test.ts` | test | transform | `tests/helpers/blob.test.ts` | role-match |
| `tests/hashtree/blossom-reference.test.ts` | test | transform | `tests/helpers/blossom-uri.test.ts` | exact |
| `tests/hashtree/secret-safety.test.ts` | test | transform/event-driven | `tests/hashtree/errors.test.ts` | role-match |
| `tests/hashtree/exports.test.ts` | test | request-response export surface | `tests/hashtree/exports.test.ts` | exact (modify) |

`tests/hashtree/isolation.test.ts` and `tests/hashtree/package.test.ts` are verification integration points rather than independent feature files. Update them only where the new runtime modules/exports change their existing allowlists and expected package targets.

## Pattern Assignments

### `src/hashtree/chk.ts` (utility/service, transform)

**Analog:** `src/helpers/blob.ts`

**Imports and byte dependency pattern** (`src/helpers/blob.ts`, lines 1-2, 34-43):

```typescript
import { bytesToHex } from "@noble/hashes/utils";
import { UploadType } from "../types.js";

let hash: Uint8Array;
if (typeof crypto !== "undefined" && crypto.subtle) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  hash = new Uint8Array(hashBuffer);
} else {
  const { sha256 } = await import("@noble/hashes/sha2");
  hash = sha256.create().update(new Uint8Array(buffer)).digest();
}
```

Copy the repository conventions, not this Blob-oriented implementation: external packages use their installed v1.8 export spellings, relative ESM imports use `.js`, and public results are `Uint8Array`. CHK should use `@noble/hashes/sha2` and `@noble/hashes/hkdf` directly plus portable `crypto.subtle` AES-GCM. It must not accept `Blob`, `Buffer`, strings, URIs, or caller-supplied encryption keys.

**Portable runtime pattern** (`src/helpers/blob.ts`, lines 26-41):

```typescript
// NOTE: use typeof File !== "undefined" to check if File is supported (required to support node 18)
if ((typeof File !== "undefined" && blob instanceof File) || blob instanceof Blob) {
  buffer = await blob.arrayBuffer();
} else {
  buffer = blob;
}
```

For CHK, preserve the same browser/Node posture by relying only on `Uint8Array`, `TextEncoder`, and Web Crypto globals available in the supported targets. Do not introduce `node:*`, `Buffer`, or DOM-only types into emitted Hashtree declarations.

**Error pattern** (`src/hashtree/errors.ts`, lines 11-25):

```typescript
export class HashtreeError extends Error {
  readonly operation?: string;
  readonly path?: string;

  constructor(message: string, options: HashtreeErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.operation = options.operation;
    this.path = options.path;
  }
}

export class HashtreeValidationError extends HashtreeError {}
export class HashtreeIntegrityError extends HashtreeError {}
```

Use `HashtreeValidationError` for malformed lengths/types before cryptographic work. Translate ciphertext-address mismatch, AES-GCM rejection, and plaintext-CHK mismatch to a fresh, identical `HashtreeIntegrityError` message with no `cause`, `path`, stage name, key, plaintext, or ciphertext attached. Copy caller arrays with `.slice()` at entry and wipe only owned derived/scratch key buffers in `finally`.

**Protocol core (no exact local analog):** use the pinned `02-RESEARCH.md` algorithm and official vectors: SHA-256 plaintext key; HKDF-SHA256 with UTF-8 salt `hashtree-chk` and info `encryption-key`; 32-byte AES key; AES-256-GCM with a 12-byte zero nonce and 128-bit tag. Decryption order is ciphertext hash, GCM authentication, then plaintext hash equals CHK key. Return only `{ ciphertext, key }` from encryption.

---

### `src/hashtree/blossom-reference.ts` (utility/model, transform)

**Analog:** `src/helpers/blossom-uri.ts`

**Typed metadata pattern** (`src/helpers/blossom-uri.ts`, lines 3-14):

```typescript
export type BlossomURI = {
  sha256: string;
  ext: string;
  servers: string[];
  authors: string[];
  size?: number;
};
```

Define the isolated Hashtree reference type in the same plain-data style, but use a discriminated plaintext/encrypted shape. The encrypted member contains `mode: "chk-v1"` and a copied, enumerable `Uint8Array` key. Add an ordered/repeatable extension-entry representation such as readonly key/value pairs; do not use a record or map that collapses duplicates.

**Parsing and validation pattern** (`src/helpers/blossom-uri.ts`, lines 16-51):

```typescript
if (!uri.startsWith("blossom:")) throw new Error("Invalid blossom URI: missing blossom: scheme");

const body = uri.slice("blossom:".length);
const queryIndex = body.indexOf("?");
const path = queryIndex === -1 ? body : body.slice(0, queryIndex);
const query = queryIndex === -1 ? "" : body.slice(queryIndex + 1);

const dotIndex = path.indexOf(".");
if (dotIndex === -1) throw new Error("Invalid blossom URI: missing file extension");

const sha256 = path.slice(0, dotIndex);
const ext = path.slice(dotIndex + 1);
if (!isSha256(sha256)) throw new Error("Invalid blossom URI: invalid sha256 hash");
if (!ext) throw new Error("Invalid blossom URI: empty file extension");

const params = new URLSearchParams(query);
const servers = params.getAll("xs");
const authors = params.getAll("as");
```

Reuse the scheme/path grammar and `URLSearchParams` entry semantics, but throw `HashtreeValidationError`. Iterate all query entries so unknown parameters and repeated values survive. Count `enc` and `k` explicitly: encrypted references require exactly one of each, `enc` must equal `chk-v1`, and `k` must be exactly 64 lowercase hex characters decoded to 32 bytes. Reject duplicate/conflicting security parameters rather than choosing a value.

**Builder pattern** (`src/helpers/blossom-uri.ts`, lines 54-64):

```typescript
export function buildBlossomURI(options: BlossomURI): string {
  const params = new URLSearchParams();
  for (const server of options.servers) params.append("xs", server);
  for (const author of options.authors) params.append("as", author);
  if (options.size !== undefined) params.append("sz", String(options.size));
  const query = params.toString();
  return `blossom:${options.sha256}.${options.ext}${query ? "?" + query : ""}`;
}
```

Follow append-based encoding. Lock the recommended recognized order `enc`, `k`, `xs`, `as`, `sz`, then extension pairs sorted by decoded key and value with stable original-order ties. Preserve input order inside `xs` and `as`. Validate builder inputs too; do not silently emit invalid hashes, extensions, sizes, modes, or key lengths.

---

### `src/hashtree/types.ts` (model, event-driven)

**Analog:** existing file, lines 1-9.

```typescript
export type MaybePromise<T> = T | PromiseLike<T>;
export type ByteStream = AsyncIterable<Uint8Array>;

export interface HashtreeOperationOptions {
  readonly signal?: AbortSignal;
}

export type HashtreeCallback<Input, Output> = (input: Input) => MaybePromise<Output>;
```

Add readonly, portable contracts alongside these definitions. Use a discriminated mode contract equivalent to `"plaintext" | "chk-v1"`, with absent mode meaning plaintext for future stateful clients. Diagnostic/progress payloads may include operation, byte counts, ciphertext hash, and non-secret mode only. They must have no plaintext, key, complete encrypted URI, or parsed capability object fields. Keep crypto primitives separate rather than introducing a mode-aware pass-through function.

---

### `src/hashtree/index.ts` (config/barrel, export surface)

**Analog:** existing file, lines 1-2.

```typescript
export * from "./types.js";
export * from "./errors.js";
```

Add curated `.js` re-exports for `chk.ts` and `blossom-reference.ts`. Do not modify `src/index.ts`; Hashtree must remain opt-in through `blossom-client-sdk/hashtree` and wildcard subpaths.

---

### `tests/hashtree/chk.test.ts` (test, transform)

**Analog:** `tests/helpers/blob.test.ts`

**Imports and deterministic vector pattern** (lines 1-10, 21-31, 72-84):

```typescript
import { describe, expect, it } from "vitest";
import { BlobHashSymbol, computeBlobSha256, getBlobSha256, getBlobSize, getBlobType } from "../../src/helpers/blob.js";

it("should return the same hash for identical content", async () => {
  // construct independent byte inputs, calculate both results, compare exact values
});

it.skipIf(typeof File === "undefined")("should handle empty content correctly", async () => {
  const expectedEmptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  expect(emptyBlobHash).toBe(expectedEmptyHash);
});
```

Use direct source imports with `.js`. Assert exact pinned empty/`hello` ciphertext and key vectors, output length, repeat determinism, identical-chunk deduplication, distinct-chunk keys, successful round trips, all three indistinguishable integrity failures, invalid lengths, and unchanged caller buffers. Keep tests runnable in both node and the browser suite; do not import Node utilities in the shared test body.

---

### `tests/hashtree/blossom-reference.test.ts` (test, transform)

**Analog:** `tests/helpers/blossom-uri.test.ts`

**Parse/build/round-trip structure** (lines 7-15, 42-58, 61-96, 98-110):

```typescript
describe("parseBlossomURI", () => {
  it("should parse a minimal URI with hash and extension", () => {
    const result = parseBlossomURI(`blossom:${HASH}.png`);
    expect(result.sha256).toBe(HASH);
  });

  it("should throw on invalid sha256", () => {
    expect(() => parseBlossomURI("blossom:abc123.png")).toThrow("invalid sha256");
  });
});

describe("round-trip", () => {
  it("should round-trip a minimal URI", () => {
    expect(buildBlossomURI(parseBlossomURI(uri))).toBe(uri);
  });
});
```

Mirror the positive, negative, builder, and round-trip grouping. Add exact checks for decoded key bytes, enumerable capability fields, every missing/duplicate/conflicting `enc`/`k` case, uppercase/short/non-hex keys, unsupported modes, repeated unknown parameters, percent encoding, canonical recognized order, deterministic sorted extensions, and builder-side validation.

---

### `tests/hashtree/secret-safety.test.ts` (test, transform/event-driven)

**Analog:** `tests/hashtree/errors.test.ts`

**Negative serialization pattern** (lines 63-84):

```typescript
const error = new HashtreeIntegrityError("Integrity verification failed", options);
const serialized = JSON.stringify(error);

expect(error).not.toHaveProperty("rawBytes");
expect(error).not.toHaveProperty("credential");
expect(error).not.toHaveProperty("callbackInput");
expect(error).not.toHaveProperty("code");
expect(error).not.toHaveProperty("toJSON");
expect(serialized).not.toContain("secret-token");
```

Use distinctive plaintext/key/full-URI sentinels. Inspect public error own properties, `cause`, messages, recursive values, and JSON serialization. Exercise each integrity failure and assert the same class/message/shape. Capture diagnostic/progress payloads and recursively assert only allowed public metadata appears. Also mutate source arrays after calls and assert returned data does not alias them; verify callers' secret arrays were never wiped or changed.

---

### `tests/hashtree/exports.test.ts` (test, export surface)

**Analog:** existing file.

**Curated runtime and root-isolation pattern** (lines 3-20, 34-36):

```typescript
import * as hashtree from "../../src/hashtree/index.js";
import * as root from "../../src/index.js";

const expectedRuntimeExports = [/* exact allowlist */];
expect(Object.keys(hashtree).sort()).toEqual(expectedRuntimeExports);
for (const name of expectedRuntimeExports) expect(root).not.toHaveProperty(name);
```

Extend the exact runtime allowlist with the chosen CHK/reference functions. Import new public types with `import type` and instantiate representative values so declaration compatibility is checked.

**Declaration consumer pattern** (lines 39-85):

```typescript
const declarations = await Promise.all(
  ["index", "types", "errors"].map((name) => readFile(`lib/hashtree/${name}.d.ts`, "utf8")),
);
expect(declarations.join("\n")).not.toMatch(/\b(?:Buffer|NodeJS)\b|node:|(?:Read|Write)Stream|FileSystem/);
```

Add `chk` and `blossom-reference` declarations to this list and compile a temporary consumer importing the exact `hashtree`, `hashtree/chk`, and `hashtree/blossom-reference` package subpaths. Retain the browser-only built-runtime import test.

## Shared Patterns

### Validation and Safe Errors

**Source:** `src/hashtree/errors.ts`, lines 11-25  
**Apply to:** `chk.ts`, `blossom-reference.ts`, and all negative tests.

Use existing typed error identities. Validation failures may state the invalid public field. Integrity failures must be generic and cause-free. Never spread arbitrary option/context objects into errors.

### Capability Ownership

**Source:** Phase 2 decisions D-11/D-13; closest test pattern `tests/hashtree/errors.test.ts`, lines 63-84.  
**Apply to:** every key/plaintext/ciphertext input and parsed encrypted reference.

All public byte inputs are caller-owned. Copy them before retention or mutation, return independent arrays, and wipe only internal derived-key buffers. Parsed encrypted references are deliberately ordinary enumerable objects; documentation and callback boundaries, not hidden properties, provide safety.

### ESM and Package Boundary

**Source:** `src/hashtree/index.ts`, lines 1-2; `tests/hashtree/exports.test.ts`, lines 3-36; `tests/hashtree/package.test.ts`, lines 8-15 and 47-66.  
**Apply to:** all new source and export tests.

Use `.js` relative specifiers. Re-export only from the Hashtree barrel. Extend packed target checks to include `lib/hashtree/chk.{js,d.ts}` and `lib/hashtree/blossom-reference.{js,d.ts}` and smoke-import their wildcard subpaths. Keep every new runtime name absent from the root entrypoint.

### Isolation Graph

**Source:** `tests/hashtree/isolation.test.ts`, lines 124-135.

```typescript
const graph = await walkEmittedGraph(join(libRoot, "index.js"));
const exclusiveHashtreeDependencies: readonly string[] = [];

for (const file of graph.visited) {
  const pathFromHashtree = relative(hashtreeRoot, file);
  expect(isAbsolute(pathFromHashtree) || pathFromHashtree.startsWith(".."), file).toBe(true);
}
for (const dependency of exclusiveHashtreeDependencies) {
  expect(graph.bareSpecifiers, dependency).not.toContain(dependency);
}
```

If `@noble/hashes` becomes reachable only through the Hashtree CHK module, add its actual emitted bare specifier(s) to `exclusiveHashtreeDependencies`. Regardless, the root emitted graph must not reach any file under `lib/hashtree/`.

### Browser/Node Test Gating

**Source:** `tests/hashtree/exports.test.ts`, lines 39-40 and 89-94.

Use `describe.runIf(typeof document === "undefined")` only around Node filesystem/package/compiler checks and `describe.runIf(typeof document !== "undefined")` around browser-specific built imports. The CHK and reference behavioral tests should otherwise execute in both environments.

## No Analog Found

There are no wholly unmatched files. `src/hashtree/chk.ts` has no local AES-GCM/HKDF implementation to copy; use the local byte/portability/error patterns above and the exact pinned protocol code and vectors from `02-RESEARCH.md` for its cryptographic core.

## Planner Notes

- Resolve the research open decision before implementation: canonical order should be locked as `enc,k,xs,as,sz`, followed by sorted extension entries, unless the plan explicitly chooses another deterministic public contract.
- Reject unsupported recognized `enc` modes; do not downgrade them to plaintext or treat `enc` as an extension.
- `sz` keeps BUD-10 addressed-blob semantics; do not infer plaintext size as ciphertext size minus 16.
- Re-check BUD-15 PR #104 head against pinned commit `ef6c7fb4435530556fb32345eec010505bda017a` at execution time because the draft remains open.
- A Phase 1 milestone changeset already exists; inspect it before creating another changeset for this phase.

## Metadata

**Analog search scope:** `src/hashtree/`, `src/helpers/`, `tests/hashtree/`, `tests/helpers/`  
**Files scanned:** 11 focused source/test analogs  
**Pattern extraction date:** 2026-08-12
