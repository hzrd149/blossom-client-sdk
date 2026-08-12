# Phase 1 Multi-Source Coverage Audit

| Source | ID | Feature / requirement | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Opt-in stable portable contracts with complete root isolation | 01-01, 01-02 | COVERED | Contract tracer plus three-dimensional isolation and packed verification. |
| REQ | PKG-01 | Import all Hashtree APIs from the dedicated subpath | 01-01 | COVERED | Exact/wildcard mappings and curated barrel. |
| REQ | PKG-02 | Root exports, evaluation, and graph stay isolated | 01-02 | COVERED | Namespace, fresh runtime, and emitted graph assertions. |
| REQ | PKG-03 | Node 18+ and browser-portable public types | 01-01 | COVERED | Web/ES-only contracts and emitted declaration audit. |
| REQ | PKG-04 | Seven stable typed failure families | 01-01 | COVERED | Base class, subclasses, safe context, and contract tests. |
| REQ | TEST-04 | Packed-package subpath and root isolation proof | 01-02 | COVERED | Real build, npm pack, extraction, self-reference imports. |
| RESEARCH | — | Focused `types.ts`, `errors.ts`, and isolated barrel | 01-01 | COVERED | Follows Architectural Responsibility Map. |
| RESEARCH | — | Exact and wildcard exports target emitted output | 01-01 | COVERED | One-way boundary gated and tested. |
| RESEARCH | — | Three independent root-isolation dimensions | 01-02 | COVERED | No dimension substitutes for another. |
| RESEARCH | — | Lightweight emitted ESM graph walker | 01-02 | COVERED | No parser/bundler package added. |
| RESEARCH | — | Extracted tarball self-reference verification | 01-02 | COVERED | No installed consumer fixture. |
| RESEARCH | — | Minor Changeset for published behavior | 01-02 | COVERED | Repository release rule honored. |
| CONTEXT | D-01, D-02, D-03, D-04 | Curated descriptive real contracts in focused modules | 01-01 | COVERED | Decision IDs cited in tracer action/truth. |
| CONTEXT | D-05, D-06, D-07, D-08 | Stable class error contract and safe context | 01-01 | COVERED | Decision IDs cited in error task/truth. |
| CONTEXT | D-09, D-10, D-11, D-12 | Portable bytes, streams, cancellation, callbacks | 01-01 | COVERED | Decision IDs cited in tracer action/truth. |
| CONTEXT | D-13 | Exact plus wildcard public package boundary | 01-01 | COVERED | One-way reversibility recorded and gated. |
| CONTEXT | D-14 | Namespace, evaluation, and graph isolation | 01-02 | COVERED | Decision ID cited in task/truth. |
| CONTEXT | D-15 | Lightweight inspection plus smallest pack check | 01-02 | COVERED | Decision ID cited in task/truth. |

## Specless fallback equality

- Edge probe surfaced 7 unresolved rows; plans author 7 explicit `must_haves.assumptions` entries (5 in 01-01 and 2 in 01-02).
- Prohibition recall retained 3 bespoke, descriptor-less, flagged-unverified entries (2 in 01-01 and 1 in 01-02).
- Canon security concerns such as archive traversal and dependency tampering are handled in each plan's STRIDE threat model rather than minted as bespoke prohibitions.
- No deferred CONTEXT items exist, and no source item is silently omitted.
