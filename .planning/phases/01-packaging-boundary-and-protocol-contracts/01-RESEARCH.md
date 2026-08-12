# Phase 1: Packaging Boundary and Protocol Contracts - Research

**Researched:** 2026-08-12
**Domain:** TypeScript ESM package boundaries, portable contracts, typed errors, and packed-artifact verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `blossom-client-sdk/hashtree` exposes a curated flat API with clearly named functions, types, errors, and—when later implemented—client classes.
- **D-02:** Use descriptive standalone names such as `encodeDirectory`, `resolveHashtree`, `HashtreeClient`, and `LoadedTree`; do not add BUD-number prefixes or an artificial namespace.
- **D-03:** Phase 1 exports only contracts that are real and useful in this phase. Do not publish placeholder functions, classes, or speculative type previews for later phases.
- **D-04:** Define public contracts in focused internal modules and re-export them through the Hashtree barrel.
- **D-05:** Provide a `HashtreeError` base class and public requirement-level subclasses for validation, integrity, bounds, conflict, immutable-tree, callback, and lifecycle failures.
- **D-06:** Class identity/name is the stable discrimination mechanism. Do not add machine-readable error codes.
- **D-07:** Errors expose safe readonly structured context where applicable, such as operation, path, limit, actual value, and cause. Sensitive values must be excluded or redacted.
- **D-08:** Human-readable messages may evolve and are not exact compatibility contracts. Do not add custom JSON serialization by default.
- **D-09:** `Uint8Array` is the canonical public byte representation. Node.js `Buffer` remains accepted through its `Uint8Array` compatibility without becoming a public Node-only type.
- **D-10:** `AsyncIterable<Uint8Array>` is the canonical large-file streaming abstraction.
- **D-11:** Portable operation option bags accept an optional `AbortSignal`. Streaming iterators must also release resources promptly when consumers terminate iteration early.
- **D-12:** Injected callbacks may return a direct value or a promise-like value where appropriate; failures use ordinary thrown or rejected errors and preserve causes.
- **D-13:** Publish both the main `./hashtree` entrypoint and wildcard `./hashtree/*` subpaths. Every Hashtree source module mapped by that wildcard is a supported public import. — **Reversibility:** one-way — Removing or renaming a published module later would break consumer imports and require a compatibility or major-version migration.
- **D-14:** Enforce both runtime and static graph isolation: the root has no Hashtree export names, importing it never evaluates Hashtree modules, and its transitive module graph contains neither Hashtree modules nor Hashtree-exclusive dependencies.
- **D-15:** Prefer lightweight local build-tree inspection over temporary consumer fixtures or broad tarball test infrastructure. Because TEST-04 is locked, planning must still include the smallest packed-package check necessary to prove the subpath resolves and the root remains isolated.

### the agent's Discretion
- Exact internal filenames and the concrete safe-context fields on each error subclass, provided they follow the focused-module and secret-redaction decisions above.
- The minimal packed-package mechanism needed to satisfy TEST-04 without creating temporary installed consumer projects.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Consumer can import all Hashtree APIs from `blossom-client-sdk/hashtree` | Exact and wildcard export-map patterns, barrel structure, and packed self-reference smoke check |
| PKG-02 | Root import does not export, evaluate, or bundle Hashtree modules or dependencies | Root export snapshot, evaluation sentinel, and transitive emitted-module graph test |
| PKG-03 | APIs work in Node 18+ and modern browsers without Node-only public types | Web-platform contract types and emitted declaration audit |
| PKG-04 | Stable typed errors cover seven requirement-level failure families | Prescriptive error hierarchy, readonly safe contexts, `cause`, `name`, and `instanceof` tests |
| TEST-04 | Packed-package tests prove subpath works while root remains isolated | Build, pack to a temporary destination, extract without install, then self-reference import both entrypoints |
</phase_requirements>

## Summary

Phase 1 should add an entirely separate `src/hashtree/` public surface and map both `./hashtree` and `./hashtree/*` to the corresponding emitted `lib/hashtree/` files. It must not edit `src/index.ts` to reference that surface. Node's export patterns are direct wildcard substitutions, so publishing `./hashtree/*` deliberately makes every matching shipped module a supported semver surface; keep only intentional public modules directly under that mapped directory. [CITED: https://nodejs.org/download/release/v22.12.0/docs/api/packages.html]

Isolation has three independent meanings and needs three independent checks: no Hashtree names in the root namespace, no Hashtree evaluation when the root is imported, and no Hashtree module or exclusive dependency reachable in the root's static transitive graph. A root export snapshot alone proves only the first. Use a small local import-graph walker over emitted ESM files (or source files if it handles type-only imports correctly), and use a module-level evaluation sentinel only in tests—not production—to prove the second. [VERIFIED: repository inspection]

The foundational contracts should be Web-platform types only: `Uint8Array`, `AsyncIterable<Uint8Array>`, `AbortSignal`, structural callback types returning `T | PromiseLike<T>`, and focused option/context interfaces. The error hierarchy is the only runtime API Phase 1 needs: one `HashtreeError` base plus seven named subclasses. JavaScript supports `instanceof` custom-error discrimination and standard `cause` propagation when options are passed to `super`. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error]

**Primary recommendation:** Implement focused `hashtree/types.ts` and `hashtree/errors.ts` modules behind an isolated barrel, then prove the contract against built declarations, the emitted dependency graph, and one extracted packed tarball using package self-reference imports.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public Hashtree subpath | Package / build boundary | Type declarations | `package.json` routes runtime and type consumers to emitted Hashtree files |
| Portable protocol contracts | Library core | Consumer adapters | Core owns shapes; future callers inject environment integrations |
| Typed error hierarchy | Library core | Consumer error handling | SDK constructs stable classes; consumers discriminate with class identity |
| Root isolation | Package / build boundary | Test infrastructure | Source/export topology creates isolation; tests prove it statically and at runtime |
| Packed-package resolution | Release artifact | Node runtime | Tarball contents plus Node self-reference exercise the actual published mapping |

## Project Constraints (from AGENTS.md)

- Keep this a single-package TypeScript ESM library; source belongs under `src/`, output under `lib/`, and build uses `pnpm build`/`tsc`.
- Define public entrypoints in `package.json` `exports`; do not flatten Hashtree through `src/index.ts`.
- Use NodeNext-compatible `.js` suffixes in relative source imports.
- Run `pnpm test`; run the browser suite only if DOM-facing media helpers are touched.
- There is no lint command. Use Prettier with 2 spaces and `printWidth: 120`.
- CI compatibility covers Node 18, 20, 22, and currently 24; the implementation must retain Node 18 support.
- Published behavior changes require a Changeset unless explicitly waived. Phase 1 changes published entrypoints and therefore needs one, even though milestone requirement TEST-05 completes release documentation later.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.8.3 (published 2025-04-05) | ESM/declaration emit | Existing project-pinned compiler; NodeNext models Node export resolution and ESM rules [VERIFIED: npm registry and repository] |
| Node.js | >=18 | Runtime and package-export resolution | Existing engine contract; export subpaths are supported in this range [CITED: https://nodejs.org/download/release/v22.12.0/docs/api/packages.html] |
| Native Web/ES types | ES2022 + DOM lib | `Uint8Array`, async iterables, `AbortSignal`, `ErrorOptions` | Already enabled in `tsconfig.json`; avoids Node-only public contracts [VERIFIED: repository inspection] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.1.3 (published 2025-05-05) | Contract, graph, and runtime tests | Existing Node test suite [VERIFIED: npm registry and repository] |
| npm CLI | 10.9.8 available | Create/inspect tarball | TEST-04 packed artifact check; `npm pack` supports JSON and dry-run output [CITED: https://docs.npmjs.com/cli/v7/commands/npm-pack/] |
| system `tar` | available | Extract a real pack artifact | Small packed smoke test without an installed consumer fixture [VERIFIED: environment probe] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extracted tarball + self-reference | Temporary installed consumer project | More realistic install, but explicitly disfavored and adds fixture/lockfile cleanup complexity |
| Local static ESM graph walker | Bundler metafile | A bundler proves one bundler's graph but adds a dependency and configuration; local inspection is sufficient for this unbundled `tsc` library |
| Focused exported modules | One large barrel-only module | Fewer files, but conflicts with the locked wildcard subpath contract and future focused growth |

**Installation:** No new runtime or development package is required. Run `pnpm install` to restore the repository-pinned toolchain before build/test work.

## Package Legitimacy Audit

No new external packages are recommended or installed in this phase, so the package legitimacy gate is not applicable.

## Architecture Patterns

### System Architecture Diagram

```text
Consumer import
  ├─ blossom-client-sdk
  │    -> package exports["."] -> lib/index.js
  │    -> existing root transitive graph only
  │    -> MUST NOT reach lib/hashtree/*
  └─ blossom-client-sdk/hashtree[/module]
       -> exact/wildcard package export
       -> lib/hashtree/index.js or lib/hashtree/<module>.js
       -> focused contracts/errors
       -> Web/ES platform types only

Build: src/**/*.ts -> tsc NodeNext -> lib/**/*.js + lib/**/*.d.ts -> npm pack -> extracted package -> self-reference smoke imports
```

### Recommended Project Structure

```text
src/
├── index.ts                 # existing root barrel; no Hashtree reference
└── hashtree/
    ├── index.ts             # curated flat Hashtree barrel
    ├── types.ts             # portable foundational contracts only
    └── errors.ts            # base plus seven public subclasses

tests/
└── hashtree/
    ├── errors.test.ts       # class identity, name, cause, readonly context behavior
    ├── exports.test.ts      # source/built export contract and root namespace
    ├── isolation.test.ts    # evaluation + transitive graph isolation
    └── package.test.ts      # packed tarball smoke test
```

### Pattern 1: Exact barrel plus wildcard exports

**What:** Add exact and pattern keys with both runtime and type conditions. Pattern replacement is direct and `*` may include nested path separators. [CITED: https://nodejs.org/download/release/v22.12.0/docs/api/packages.html]
**When to use:** For the locked opt-in surface and supported module-level imports.

```json
{
  "./hashtree": {
    "import": "./lib/hashtree/index.js",
    "types": "./lib/hashtree/index.d.ts"
  },
  "./hashtree/*": {
    "import": "./lib/hashtree/*.js",
    "types": "./lib/hashtree/*.d.ts"
  }
}
```

Do not place private implementation modules under a path matched by this wildcard unless they are intentionally public forever. [VERIFIED: locked D-13 plus Node pattern semantics]

### Pattern 2: Portable callback and streaming contracts

```typescript
export type MaybePromise<T> = T | PromiseLike<T>;

export interface HashtreeOperationOptions {
  signal?: AbortSignal;
}

export type ByteStream = AsyncIterable<Uint8Array>;
export type HashtreeCallback<Input, Output> = (input: Input) => MaybePromise<Output>;
```

These declarations emit no runtime imports and expose no `Buffer`, Node stream, filesystem, or relay-library type. [VERIFIED: TypeScript language behavior and locked D-09 through D-12]

### Pattern 3: Stable class identity with safe structured context

```typescript
export interface HashtreeErrorOptions extends ErrorOptions {
  readonly operation?: string;
  readonly path?: string;
}

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
```

Apply the same thin subclass pattern to `HashtreeIntegrityError`, `HashtreeBoundsError`, `HashtreeConflictError`, `HashtreeImmutableTreeError`, `HashtreeCallbackError`, and `HashtreeLifecycleError`. Use per-class option interfaces only where fields differ (for example `limit`/`actual` for bounds); never accept open-ended context records that could accidentally retain secrets. `cause` can be any value, so do not traverse or serialize it. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause]

### Anti-Patterns to Avoid

- **Root re-export or import:** Any value or type import from `src/index.ts` to `src/hashtree/*` violates the boundary; type-only reachability still violates the locked static graph rule.
- **Wildcard-mapped private files:** A helper under `src/hashtree/internal.ts` becomes importable through `blossom-client-sdk/hashtree/internal` after build.
- **One generic error with string codes:** Violates D-05/D-06; consumers must use stable classes.
- **Public `Buffer`, Node streams, or Node error types:** Pollutes declarations and breaks browser portability.
- **Testing source only:** Source imports bypass the published export map and cannot satisfy TEST-04.
- **Only testing namespace keys:** Does not prove non-evaluation or transitive dependency isolation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subpath routing | Runtime dispatcher | `package.json` `exports` exact/pattern mappings | Native Node/tooling semantics and declaration routing |
| Error chaining | Custom nested-error serializer | Standard `ErrorOptions.cause` | Preserves original thrown/rejected value without message parsing |
| Async stream abstraction | Bespoke stream class | `AsyncIterable<Uint8Array>` | Portable backpressure and early-return semantics |
| Cancellation token | Custom boolean/token | `AbortSignal` | Standard Node 18+/browser contract |
| Packed package listing | Custom packlist algorithm | `npm pack --json` / actual tarball | Matches npm publication rules |
| Isolation proof | Full bundler harness | Small ESM import walker plus runtime import test | No new package and matches this unbundled output topology |

**Key insight:** This phase is contract topology, not protocol behavior. Native platform/package mechanisms already solve the difficult compatibility edges; custom abstractions would expand the public surface prematurely.

## Common Pitfalls

### Pitfall 1: Wildcard unintentionally publishes internals
**What goes wrong:** Consumers import a helper that was assumed private, making later removal a breaking change.
**Why it happens:** `*` is direct substitution and supports nested segments.
**How to avoid:** Keep wildcard-matched modules few, focused, and intentional; move future private code below an explicitly blocked/non-matched location or use filenames outside the public mapping.
**Warning signs:** Files under `src/hashtree/` that are not re-exported but still contain reusable implementation logic.

### Pitfall 2: Root isolation tested too weakly
**What goes wrong:** Root keys stay unchanged but root evaluation or graph still pulls Hashtree code/dependencies.
**Why it happens:** Namespace snapshots observe exports, not import graph/evaluation.
**How to avoid:** Assert all three dimensions independently and fail graph traversal on `lib/hashtree/` and an explicit list of Hashtree-exclusive package specifiers.
**Warning signs:** Only `tests/index.test.ts` changes.

### Pitfall 3: Type-only leakage is overlooked
**What goes wrong:** JavaScript runtime is isolated, but root declarations or Hashtree declarations expose `Buffer`, Node streams, or exclusive dependencies.
**Why it happens:** Runtime tests cannot see declaration imports.
**How to avoid:** Inspect emitted `.d.ts` files and compile a minimal browser-oriented type probe with no Node types available. TypeScript follows `exports` and the `types` condition in NodeNext resolution. [CITED: https://www.typescriptlang.org/docs/handbook/modules/reference]
**Warning signs:** `@types/node` names in public Hashtree declarations or imports from `node:*`.

### Pitfall 4: Pack runs before build
**What goes wrong:** `files: ["lib", "src"]` allows packing, but missing `lib/` means the advertised export targets do not exist.
**Why it happens:** `npm pack` does not substitute for `pnpm build`; this checkout currently has no `node_modules`, and the observed dry run omitted `lib/index.js`.
**How to avoid:** Restore dependencies, build, then pack; make the test assert the exact JS and `.d.ts` targets exist in the tarball before importing.
**Warning signs:** `npm pack --dry-run --json` reports no `lib/hashtree/index.js`.

### Pitfall 5: Error context becomes a secret sink
**What goes wrong:** Arbitrary callback inputs, URLs with keys, raw nodes, or byte arrays are retained in errors.
**Why it happens:** Open context dictionaries are convenient.
**How to avoid:** Define narrow readonly fields per error family; store only safe summaries such as operation, logical path, numeric limit/actual, and standard cause.
**Warning signs:** `Record<string, unknown>`, request bodies, raw references, or serialized causes on public errors.

### Pitfall 6: Exact error messages become tests/contracts
**What goes wrong:** Harmless message improvements break consumers/tests.
**Why it happens:** `toThrow("exact text")` is simpler than checking class and fields.
**How to avoid:** Test `instanceof`, `.name`, safe fields, and `.cause`; use partial message assertions only for readability.
**Warning signs:** Inline snapshots of whole errors or exact string equality.

## Code Examples

### Packed package smoke test without installing a consumer project

```typescript
// After pnpm build, create an actual tarball in a temporary destination.
// Extract it and write package/consumer-smoke.mjs inside the extracted package scope.
// Run `node package/consumer-smoke.mjs`; its package self-references use the
// extracted package.json exports map without relying on eval-input package scope.
// Also import the root and assert its keys contain no Hashtree names.
```

`npm pack` creates a tarball and writes included filenames; `--json` makes the result machine-readable. [CITED: https://docs.npmjs.com/cli/v7/commands/npm-pack/]

### Static graph isolation walker

```typescript
// Start at lib/index.js.
// Parse static `import ... from`, `export ... from`, and literal `import("...")` specifiers.
// Resolve only relative specifiers recursively; collect bare package specifiers separately.
// Assert no visited path is under lib/hashtree and no bare specifier is Hashtree-exclusive.
// Keep parser scope deliberately aligned with tsc-emitted ESM syntax.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Deep imports without export map | Explicit `exports` subpaths | Node 12.7+ | Public modules are intentionally enumerated/ patterned and undeclared paths are blocked |
| Folder export mappings | Subpath wildcard patterns | Node 12.20+/14.13+ | Use `./hashtree/*`, not deprecated trailing-slash folder mappings [CITED: https://nodejs.org/download/release/v22.12.0/docs/api/packages.html] |
| Message parsing for error kind | Custom subclasses + `instanceof` | Standard ES classes | Stable discrimination independent of mutable human messages |
| Custom wrapped-error field | Standard `ErrorOptions.cause` | Widely available since 2021 | Portable cause preservation across supported targets [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause] |

**Deprecated/outdated:**
- Trailing-slash folder mappings: use subpath patterns.
- Extensionless relative imports inside NodeNext ESM source: continue repository `.js` suffix convention.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Package self-reference is exercised from a temporary `.mjs` written inside the extracted package, so Node establishes package scope from a real module URL rather than relying on eval-input behavior. [RESOLVED] | Code Examples | The file is test-owned, contains only import assertions, and is removed with the extraction directory; no installed consumer project is needed. |

## Open Questions (RESOLVED)

1. **Which Hashtree dependencies count as “exclusive” in the graph assertion? — RESOLVED**
   - Decision: The Phase 1 exclusive-package denylist is empty because this phase installs and imports no Hashtree-only package. The graph helper accepts an explicit exclusive-package list, and each later phase that introduces a Hashtree-only bare dependency must add it when that dependency is introduced. Hashtree emitted paths are always forbidden independently of this list.
   - Evidence: Phase 1's package legitimacy audit specifies no new package, while the existing root already legitimately reaches shared dependencies such as `@noble/hashes`; classifying shared dependencies as exclusive would create a false failure.

2. **Should wildcard exposure include `index` as `blossom-client-sdk/hashtree/index`? — RESOLVED**
   - Decision: Yes. Per D-13, the wildcard intentionally exposes every matched shipped module, including `blossom-client-sdk/hashtree/index`; no null exclusion is added. Both the exact spelling and `/index` are supported public imports and the packed-package test must exercise them.
   - Evidence: Node subpath patterns perform direct wildcard substitution, so `./hashtree/*` maps `index` to the shipped `lib/hashtree/index.js`; excluding it would contradict the locked wildcard policy.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/test/package smoke | ✓ | 22.23.1 | CI verifies 18/20/22/24 |
| pnpm | install/build/test | ✓ | 10.10.0 | — |
| npm | pack artifact | ✓ | 10.9.8 | `pnpm pack` only if output semantics are verified |
| tar | extract artifact | ✓ | system `/usr/bin/tar` | Node tar library would add an unwanted dependency |
| installed dev dependencies | `tsc`, Vitest, Prettier | ✗ | `node_modules` absent | Run `pnpm install` before execution |

**Missing dependencies with no fallback:**
- Repository dependencies must be restored with `pnpm install`; current `pnpm build` fails with `tsc: not found`.

**Missing dependencies with fallback:** None.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication behavior in Phase 1 |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No protected resource access |
| V5 Input Validation | yes | Typed validation/bounds errors establish later failure contracts; algorithms are deferred |
| V6 Cryptography | no | Cryptography begins Phase 2; do not add crypto behavior here |

### Known Threat Patterns for TypeScript package contracts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sensitive data retained in error context/cause serialization | Information Disclosure | Narrow readonly safe fields; no custom JSON serialization; never traverse cause |
| Root import unexpectedly evaluates specialized code | Tampering / Information Disclosure | Runtime evaluation assertion plus transitive graph gate |
| Node-only types force unsafe browser shims | Denial of Service | Declaration audit using only Web/ES platform types |
| Unbounded/context-rich error objects retain large byte arrays | Denial of Service | Numeric summaries and logical identifiers only; never raw bytes/trees |

## Sources

### Primary (HIGH confidence)
- Repository `package.json`, `tsconfig.json`, `src/index.ts`, `src/error.ts`, `src/types.ts`, tests, and CI workflows — current local architecture and commands
- [Node.js Packages documentation](https://nodejs.org/download/release/v22.12.0/docs/api/packages.html) — export encapsulation, exact subpaths, wildcard patterns
- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference) — NodeNext, ESM detection, exports and types conditions
- [npm pack documentation](https://docs.npmjs.com/cli/v7/commands/npm-pack/) — tarball, JSON, and dry-run behavior
- [MDN Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) and [Error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) — subclass identity and cause semantics

### Secondary (MEDIUM confidence)
- npm registry queries — repository-pinned TypeScript/Vitest/Prettier version and publication dates

### Tertiary (LOW confidence)
- None; Assumption A1 is resolved by using a real temporary `.mjs` within the extracted package scope.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing pinned project stack and current registry checks; no new packages
- Architecture: HIGH — locked decisions align directly with current explicit export/NodeNext layout and official docs
- Pitfalls: HIGH — derived from actual package topology, observed missing build output, and official export/error semantics

**Research date:** 2026-08-12
**Valid until:** 2026-09-11
