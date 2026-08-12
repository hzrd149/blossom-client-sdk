# Phase 1: Packaging Boundary and Protocol Contracts - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 9 new/modified files
**Analogs found:** 7 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hashtree/index.ts` | config / public barrel | transform | `src/actions/index.ts` | exact |
| `src/hashtree/types.ts` | model / public contracts | streaming, request-response | `src/types.ts` | role-match |
| `src/hashtree/errors.ts` | utility / error model | request-response | `src/error.ts` | role-match |
| `package.json` | config / package boundary | transform | existing `exports` entries in `package.json` | exact |
| `tests/hashtree/errors.test.ts` | test | request-response | `tests/error.test.ts` | exact |
| `tests/hashtree/exports.test.ts` | test | transform | `tests/actions/index.test.ts` and `tests/index.test.ts` | exact |
| `tests/hashtree/isolation.test.ts` | test | file-I/O / static graph | `tests/index.test.ts` | partial |
| `tests/hashtree/package.test.ts` | test | file-I/O / batch | none | none |
| `.changeset/<generated-name>.md` | config / release metadata | transform | none (only generated README/config exist) | none |

`src/index.ts` is deliberately **not** a modified file. Its unchanged import graph is part of the Phase 1 contract. The exact test filenames may be consolidated by the planner, but the four responsibilities above must remain independently asserted.

## Pattern Assignments

### `src/hashtree/index.ts` (config/public barrel, transform)

**Analog:** `src/actions/index.ts`

**Flat ESM barrel pattern** (`src/actions/index.ts`, lines 1-10):

```typescript
export * from "./upload.js";
export * from "./mirror.js";
export * from "./list.js";
export * from "./delete.js";
export * from "./download.js";
export * from "./has.js";
export * from "./resolve.js";
export * from "./multi-server.js";
export * from "./media.js";
export * from "./report.js";
```

Copy the direct `export *` style and mandatory `.js` suffixes. For Phase 1, export only `./types.js` and `./errors.js`. Do not import or re-export this barrel from `src/index.ts`; the root currently contains only existing exports (`src/index.ts`, lines 1-8).

---

### `src/hashtree/types.ts` (model/public contracts, streaming and request-response)

**Analog:** `src/types.ts`

**Structural public-type pattern** (`src/types.ts`, lines 21-31):

```typescript
/** An async method used to sign nostr events */
export type Signer = (draft: EventTemplate) => Promise<SignedEvent>;

/** interface for handling payment requests */
export interface PaymentHandlers<S extends ServerType = ServerType> {
  upload?: UploadOptions<S, UploadType>["onPayment"];
  download?: DownloadOptions<S>["onPayment"];
  list?: ListOptions<S>["onPayment"];
  mirror?: MirrorOptions<S>["onPayment"];
  delete?: DeleteOptions<S>["onPayment"];
}
```

**Dependency-isolating structural-copy pattern** (`src/types.ts`, lines 43-50):

```typescript
// NOTE: structural copies of cashu-ts types so @cashu/cashu-ts can stay an
// optional peer dependency. Keep field shapes in sync with cashu-ts upstream.

export type PaymentRequestTransport = {
  type: string;
  target: string;
  tags?: Array<Array<string>>;
};
```

Follow the repository's exported `type`/`interface` convention, but improve portability for this isolated surface: use only `Uint8Array`, `AsyncIterable<Uint8Array>`, `AbortSignal`, and structural generics. The foundational shapes recommended by research are `MaybePromise<T>`, `ByteStream`, `HashtreeOperationOptions`, and callback types returning `T | PromiseLike<T>`. Avoid `Buffer` (the legacy root type at `src/types.ts`, line 7), Node streams, filesystem types, and runtime imports.

---

### `src/hashtree/errors.ts` (utility/error model, request-response)

**Analog:** `src/error.ts`

**Local custom-error and typed discrimination pattern** (`src/error.ts`, lines 10-26):

```typescript
export default class HTTPError extends Error {
  response: Response;
  status: number;
  body?: { message: string };
  code?: RejectionCode;

  constructor(response: Response, body: { message: string } | string) {
    super(typeof body === "string" ? body : body.message);
    this.response = response;
    this.status = response.status;
    this.code = REJECTION_CODES[response.status];

    if (typeof body == "object") this.body = body;
  }

  static isRejection(error: unknown): error is HTTPError & { code: RejectionCode } {
    return error instanceof HTTPError && error.code !== undefined;
  }
}
```

Use the same native `Error` subclass and `instanceof` model, but implement the locked Phase 1 contract rather than copying legacy mutable fields or string codes. `HashtreeError` should call `super(message, { cause: options.cause })`, set `this.name = new.target.name`, and copy only narrow `readonly` safe fields. Add thin public subclasses for validation, integrity, bounds, conflict, immutable-tree, callback, and lifecycle failures. Bounds may expose `limit` and `actual`; common safe context may expose `operation` and logical `path`. Do not retain raw bytes, callback inputs, credentials, arbitrary records, or serialized causes.

---

### `package.json` (config/package boundary, transform)

**Analog:** existing exact-plus-wildcard helper exports.

**Export-map pattern** (`package.json`, lines 36-43):

```json
"./helpers": {
  "import": "./lib/helpers/index.js",
  "types": "./lib/helpers/index.d.ts"
},
"./helpers/*": {
  "import": "./lib/helpers/*.js",
  "types": "./lib/helpers/*.d.ts"
}
```

Add sibling `./hashtree` and `./hashtree/*` entries with the same condition ordering and paths rooted at `./lib/hashtree/`. The package already ships both `lib` and `src` (`package.json`, lines 19-22) and targets Node 18+ (`package.json`, lines 61-63), so no new package or script is required. Treat every direct module matched by the wildcard as permanently public.

---

### `tests/hashtree/errors.test.ts` (test, request-response)

**Analog:** `tests/error.test.ts`

**Vitest error assertion pattern** (`tests/error.test.ts`, lines 1-17):

```typescript
import { describe, expect, it, vi } from "vitest";
import HTTPError from "../src/error";

describe("HTTPError", () => {
  describe("handleErrorResponse", () => {
    it("should throw an HTTPError when response is not ok", async () => {
      // ...
      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toThrow("Missing auth header");
      await expect(HTTPError.handleErrorResponse(mockResponse)).rejects.toBeInstanceOf(HTTPError);
    });
  });
});
```

Retain Vitest's `describe`/`it`/`expect` organization, but assert stable contracts rather than exact full messages: each subclass is an `instanceof` both itself and `HashtreeError`, `.name` equals its class name, safe readonly fields are retained, and `.cause` preserves the original value. Verify bounds-specific fields and absence of arbitrary/sensitive context.

---

### `tests/hashtree/exports.test.ts` (test, transform)

**Analogs:** `tests/actions/index.test.ts` and `tests/index.test.ts`

**Sub-barrel namespace snapshot** (`tests/actions/index.test.ts`, lines 1-6):

```typescript
import { expect, it } from "vitest";

import * as actions from "../../src/actions/index";

it("should export expected methods", () => {
  expect(Object.keys(actions).sort()).toMatchInlineSnapshot(`
```

**Root namespace isolation snapshot** (`tests/index.test.ts`, lines 1-6):

```typescript
import { expect, it } from "vitest";

import * as library from "../src/index";

it("should export expected methods", () => {
  expect(Object.keys(library).sort()).toMatchInlineSnapshot(`
```

Snapshot the curated Hashtree runtime keys (the error classes; types disappear at runtime), explicitly type-check the public contracts, and preserve/assert the root snapshot contains no Hashtree names. Also inspect built `.d.ts` output for `Buffer`, `node:`, Node streams, or Hashtree-exclusive package imports. Source-relative tests use the repository's current mixed convention; new nested tests should use explicit `.js` suffixes consistently with NodeNext source style.

---

### `tests/hashtree/isolation.test.ts` (test, file-I/O/static graph)

**Partial analog:** `tests/index.test.ts` proves namespace isolation only.

Use its root namespace assertion above, then add the research-prescribed emitted-ESM graph walker. Start at `lib/index.js`; collect static `import ... from`, `export ... from`, side-effect imports, and literal dynamic imports; resolve relative specifiers recursively; record bare specifiers separately. Assert no visited path is within `lib/hashtree/` and no Hashtree-exclusive dependency is reachable. Keep the parser deliberately limited to syntax emitted by this repository's `tsc` build. Runtime non-evaluation should be proven without adding a production sentinel: import the built root in a fresh process/module context and verify no Hashtree module is reached by the graph plus no Hashtree runtime export is present.

No exact repository analog exists for filesystem graph traversal, so use the concrete algorithm in `01-RESEARCH.md` rather than introducing a parser/bundler dependency.

---

### `tests/hashtree/package.test.ts` (test, file-I/O/batch)

**Analog:** none in the repository.

Follow the research's minimal artifact flow: build first, run `npm pack --json --pack-destination <temporary-directory>`, parse the emitted tarball name, extract it with system `tar`, and assert the exact JS and declaration targets for `./hashtree` and module subpaths exist. From the extracted package root, use Node package self-reference to import `blossom-client-sdk/hashtree`, `blossom-client-sdk/hashtree/errors`, and the root package; check the Hashtree entries resolve and root keys remain isolated. Always clean temporary resources in `finally`. Do not create an installed consumer fixture or lockfile.

Because no local subprocess/temp-directory test precedent exists, planner actions should spell out Node standard-library imports (`node:child_process`, `node:fs/promises`, `node:os`, `node:path`) and keep them test-only; these must never enter emitted public declarations.

---

### `.changeset/<generated-name>.md` (config/release metadata, transform)

**Analog:** none; `.changeset/` currently contains only tool-generated `README.md` and `config.json`.

Use standard Changesets frontmatter naming `blossom-client-sdk` with the version bump selected by planning (a new public subpath and error API normally warrants `minor`), followed by a concise consumer-facing summary of the opt-in Hashtree contracts. The configured access is public and base branch is `master` (`.changeset/config.json`, lines 7-10).

## Shared Patterns

### ESM and Public Barrels

**Source:** `src/actions/index.ts`, lines 1-10  
**Apply to:** `src/hashtree/index.ts` and all future Hashtree relative exports

```typescript
export * from "./upload.js";
```

Use `.js` on relative source specifiers. Keep the Hashtree surface flat and curated, while recognizing that wildcard-mapped direct files are independently public.

### Root Isolation

**Source:** `src/index.ts`, lines 1-8  
**Apply to:** package/export and all isolation tests

```typescript
export * from "./const.js";
export * from "./auth.js";
export * from "./helpers/index.js";
export * from "./media.js";
export * from "./nostr.js";
export * from "./error.js";
export * from "./types.js";
export * as Actions from "./actions/index.js";
```

Do not add a Hashtree import, export, or type export here. Test namespace, evaluation, and transitive static graph separately.

### Portable Cancellation

**Source:** `src/helpers/signal.ts`, lines 3-19  
**Apply to:** public option contracts now and streaming implementations in later phases

```typescript
export function wrapSignalWithTimeout(
  timeout: number,
  message: string,
  signal: AbortSignal | undefined,
): { cancel: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  // ...
  return { cancel, signal: controller.signal };
}
```

Expose the Web-platform `AbortSignal`, not a custom or Node cancellation type. Later async iterators must also release resources from `return()`/early consumer termination.

### Error Discrimination and Cause Preservation

**Source:** `src/error.ts`, lines 10-26, adapted by the Phase 1 research contract  
**Apply to:** all Hashtree errors and error tests

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
```

Class identity is the discriminator. Do not add codes, exact-message snapshots, generic context records, or custom serialization.

### Test Style

**Source:** `tests/index.test.ts`, lines 1-6 and `tests/error.test.ts`, lines 4-17  
**Apply to:** all Hashtree tests

Use Vitest direct imports, behavior-named `it` blocks, focused `describe` groups, namespace snapshots where the entire public surface is the contract, and `toBeInstanceOf` plus field assertions for errors.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/hashtree/package.test.ts` | test | file-I/O / batch | No repository test currently packs, extracts, or self-references the published artifact. Use `01-RESEARCH.md`'s minimal flow. |
| `.changeset/<generated-name>.md` | config | transform | No existing release changeset remains in the checkout; use standard Changesets frontmatter. |

## Metadata

**Analog search scope:** `src/`, `tests/`, `package.json`, `.changeset/`, `.github/`  
**Files scanned:** 39 source/test files plus package and Changesets configuration  
**Strong analogs read:** `src/error.ts`, `src/types.ts`, `src/index.ts`, `src/actions/index.ts`, `src/helpers/signal.ts`, `tests/error.test.ts`, `tests/index.test.ts`, `tests/actions/index.test.ts`, `tests/helpers/signal.test.ts`  
**Pattern extraction date:** 2026-08-12
