# Phase 1: Packaging Boundary and Protocol Contracts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 1-packaging-boundary-and-protocol-contracts
**Areas discussed:** Hashtree API organization, Typed error contract, Portable data contracts, Isolation guarantees

---

## Hashtree API Organization

Selected a curated flat entrypoint with descriptive standalone names. Phase 1 exposes only implemented contracts. Public definitions live in focused modules re-exported by the Hashtree barrel.

Alternatives considered: namespace groups, nested-only subpaths, BUD-prefixed names, speculative type previews, a single contracts file, and a nested types barrel.

## Typed Error Contract

Selected a `HashtreeError` base with requirement-level category subclasses and safe readonly context. The initial option included stable error codes, but the user explicitly removed codes: class identity/name is sufficient. Messages may evolve and errors need no custom JSON form.

Alternatives considered: one coded error class, highly specific subclasses, broad protocol/state/integration categories, code-and-message-only context, an open details record, stable exact messages, and serialized errors.

## Portable Data Contracts

Selected `Uint8Array` for bytes and `AsyncIterable<Uint8Array>` for streams. Cancellation uses optional `AbortSignal` and must also support early iterator cleanup. Callbacks may return direct or promise-like values and throw/reject on failure.

Alternatives considered: `ArrayBuffer`, `Blob`, Web `ReadableStream`, dual stream forms, iterator-only cancellation, custom tokens, promises-only callbacks, and result objects.

## Isolation Guarantees

Selected `./hashtree` plus wildcard `./hashtree/*` exports, with every mapped Hashtree source module treated as supported public API. Root isolation covers exports, runtime evaluation, and the static transitive graph. The user prefers local build-tree inspection and no temporary consumer fixtures; the locked TEST-04 requirement still requires the smallest sufficient packed-package check.

Alternatives considered: one entrypoint only, curated wildcard modules, conditional Node/browser entries, runtime-only isolation, export-name-only isolation, installed consumer fixtures, tarball smoke imports, and tarball inspection.

## the agent's Discretion

- Exact internal filenames and safe contextual fields per error subclass.
- The smallest packed-package test mechanism that satisfies TEST-04 without broad fixture infrastructure.

## Deferred Ideas

None.
