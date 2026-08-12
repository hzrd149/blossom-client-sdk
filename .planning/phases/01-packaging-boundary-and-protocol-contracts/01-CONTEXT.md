# Phase 1: Packaging Boundary and Protocol Contracts - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the opt-in `blossom-client-sdk/hashtree` package boundary, portable foundational contracts, and stable typed error hierarchy. Existing root-import consumers must remain isolated from all Hashtree exports, evaluation, and exclusive dependencies. Protocol algorithms and higher-level client behavior belong to later phases.

</domain>

<decisions>
## Implementation Decisions

### Hashtree API organization
- **D-01:** `blossom-client-sdk/hashtree` exposes a curated flat API with clearly named functions, types, errors, and—when later implemented—client classes.
- **D-02:** Use descriptive standalone names such as `encodeDirectory`, `resolveHashtree`, `HashtreeClient`, and `LoadedTree`; do not add BUD-number prefixes or an artificial namespace.
- **D-03:** Phase 1 exports only contracts that are real and useful in this phase. Do not publish placeholder functions, classes, or speculative type previews for later phases.
- **D-04:** Define public contracts in focused internal modules and re-export them through the Hashtree barrel.

### Typed error contract
- **D-05:** Provide a `HashtreeError` base class and public requirement-level subclasses for validation, integrity, bounds, conflict, immutable-tree, callback, and lifecycle failures.
- **D-06:** Class identity/name is the stable discrimination mechanism. Do not add machine-readable error codes.
- **D-07:** Errors expose safe readonly structured context where applicable, such as operation, path, limit, actual value, and cause. Sensitive values must be excluded or redacted.
- **D-08:** Human-readable messages may evolve and are not exact compatibility contracts. Do not add custom JSON serialization by default.

### Portable data contracts
- **D-09:** `Uint8Array` is the canonical public byte representation. Node.js `Buffer` remains accepted through its `Uint8Array` compatibility without becoming a public Node-only type.
- **D-10:** `AsyncIterable<Uint8Array>` is the canonical large-file streaming abstraction.
- **D-11:** Portable operation option bags accept an optional `AbortSignal`. Streaming iterators must also release resources promptly when consumers terminate iteration early.
- **D-12:** Injected callbacks may return a direct value or a promise-like value where appropriate; failures use ordinary thrown or rejected errors and preserve causes.

### Package boundary and isolation
- **D-13:** Publish both the main `./hashtree` entrypoint and wildcard `./hashtree/*` subpaths. Every Hashtree source module mapped by that wildcard is a supported public import. — **Reversibility:** one-way — Removing or renaming a published module later would break consumer imports and require a compatibility or major-version migration.
- **D-14:** Enforce both runtime and static graph isolation: the root has no Hashtree export names, importing it never evaluates Hashtree modules, and its transitive module graph contains neither Hashtree modules nor Hashtree-exclusive dependencies.
- **D-15:** Prefer lightweight local build-tree inspection over temporary consumer fixtures or broad tarball test infrastructure. Because TEST-04 is locked, planning must still include the smallest packed-package check necessary to prove the subpath resolves and the root remains isolated.

### the agent's Discretion
- Exact internal filenames and the concrete safe-context fields on each error subclass, provided they follow the focused-module and secret-redaction decisions above.
- The minimal packed-package mechanism needed to satisfy TEST-04 without creating temporary installed consumer projects.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements
- `.planning/PROJECT.md` — Defines module isolation, portability, functional-first architecture, and the milestone-wide Hashtree boundary.
- `.planning/REQUIREMENTS.md` — PKG-01 through PKG-04 and TEST-04 are the locked Phase 1 requirements.
- `.planning/ROADMAP.md` — Defines the Phase 1 goal, fixed boundary, and success criteria.

### Existing repository guidance
- `AGENTS.md` — Defines repository shape, public entrypoint conventions, verification commands, and release expectations.

No external protocol specification is required for this packaging-and-contract phase; BUD algorithm details begin in later phases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/error.ts`: Existing custom-error style and cause/response handling provide a local precedent, though Hashtree needs its own exported hierarchy.
- `src/types.ts`: Demonstrates structural, callback-injected public types and the need for type-only imports to avoid runtime cycles.
- `src/helpers/signal.ts`: Existing cancellation and timeout behavior can inform `AbortSignal` propagation.

### Established Patterns
- The package is TypeScript ESM with NodeNext resolution; relative source imports use `.js` suffixes and declarations are emitted into `lib/`.
- Public surfaces are export-driven through focused modules, barrels, and explicit `package.json` export mappings.
- Browser/Node portability relies on Web-platform types and caller-injected integrations rather than Node-only core APIs.
- Specialized dependencies are isolated through subpaths, type-only imports, or lazy dynamic imports.

### Integration Points
- Add the dedicated Hashtree source barrel and wildcard-compatible public modules without importing them from `src/index.ts`.
- Extend `package.json` exports so `./hashtree` and `./hashtree/*` resolve to their own `lib/` JavaScript and declaration files.
- Add tests around emitted declarations, export targets, root exports/evaluation, and the root transitive module graph.
- Build and package verification must operate on generated `lib/` output while source changes remain under `src/`.

</code_context>

<specifics>
## Specific Ideas

- Prefer familiar descriptive names over protocol-number-prefixed names.
- Keep verification lightweight: avoid temporary installed consumer fixtures unless no smaller mechanism can satisfy the locked packed-package requirement.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-packaging-boundary-and-protocol-contracts*
*Context gathered: 2026-08-12*
