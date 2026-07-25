# Roadmap: Blossom Client SDK Hashtree Support

**Created:** 2026-07-25
**Granularity:** Coarse
**Execution:** Parallel where plans are independent
**Core Value:** Consumers can round-trip hashtree content through Blossom servers using a clear experimental SDK API that follows the current BUD-15 to BUD-18 specifications.

## Milestone Goal

Add experimental end-to-end BUD-15 through BUD-18 hashtree support to `blossom-client-sdk` while preserving existing Blossom server action behavior and package ergonomics.

## Phase Overview

| Phase | Name | Goal | Requirements | Depends On |
|-------|------|------|--------------|------------|
| 1 | Protocol Foundations | Implement vector-tested CHK, canonical MessagePack, `nhash`, and `htree://` primitives. | PROTO-01..PROTO-06, TEST-01, TEST-02 | Existing SDK helpers |
| 2 | Tree Builder And Traversal | Build deterministic files/directories/fanout with safety limits. | TREE-01..TREE-05, TEST-01, TEST-02 | Phase 1 |
| 3 | End-To-End Hashtree Actions | Compose existing Blossom upload/download/multi-server actions into hashtree upload, resolve, download, and listing APIs. | E2E-01..E2E-06, TEST-03 | Phases 1-2 |
| 4 | Mutable Roots And Visibility | Add BUD-18 mutable root event helpers, callback-based root resolution, and all visibility modes. | ROOT-01..ROOT-06 | Phases 1-3 |
| 5 | Experimental Public Surface | Wire exports, docs, build verification, and release metadata. | API-01..API-05, TEST-04 | Phases 1-4 |

## Phase 1: Protocol Foundations

**Goal:** Establish byte-accurate, vector-tested protocol primitives before any network orchestration depends on them.

**Deliverables:**
- CHK crypto helpers for BUD-15 encryption/decryption and commitment validation.
- Encrypted Blossom URI parameter helpers for `enc=chk-v1` and `k`.
- Deterministic MessagePack tree node codec for BUD-16/BUD-17.
- BUD-18 `nhash` and `htree://` immutable/mutable parser/builder primitives.
- Initial typed errors and shared protocol types.

**Likely files:**
- `src/helpers/hashtree-chk.ts`
- `src/helpers/hashtree-manifest.ts`
- `src/helpers/hashtree-uri.ts`
- `src/helpers/index.ts`
- `tests/helpers/hashtree-chk.test.ts`
- `tests/helpers/hashtree-manifest.test.ts`
- `tests/helpers/hashtree-uri.test.ts`

**Research before planning:**
- Re-check PRs #104, #105, and #107 for current vectors, field ordering, TLV table, and crypto parameters.
- Decide whether Web Crypto is sufficient or whether an optional crypto dependency is needed.

**Success Criteria:**
- Exact draft vectors pass.
- Negative integrity and malformed input tests fail closed.
- No HTTP/fetch behavior is introduced in primitive modules.

## Phase 2: Tree Builder And Traversal

**Goal:** Build and traverse local hashtree structures deterministically, including large files/directories and bounded untrusted data traversal.

**Deliverables:**
- Directory manifest creation and validation.
- File chunking using current BUD-17 constants.
- Chunked file manifest creation and ordered reassembly helpers.
- Directory fanout writer/reader using the current BUD-17 structural fanout format.
- Path traversal, directory listing, visited-set tracking, byte/depth/link limits, and concurrency limit types.

**Likely files:**
- `src/helpers/hashtree-builder.ts`
- `src/helpers/hashtree-traverse.ts`
- `src/helpers/hashtree-manifest.ts`
- `tests/helpers/hashtree-builder.test.ts`
- `tests/helpers/hashtree-traverse.test.ts`

**Research before planning:**
- Reconcile PR #106 fanout semantics immediately before planning, especially any `t = 2` versus `t = 3` draft drift and metadata field names.

**Success Criteria:**
- Small and large files round-trip locally.
- Large directories produce bounded fanout and traverse by path.
- Traversal limits prevent unbounded recursion and repeated-node loops.

## Phase 3: End-To-End Hashtree Actions

**Goal:** Provide the user-requested end-to-end SDK APIs for creating/uploading and resolving/downloading hashtrees through ordinary Blossom servers.

**Deliverables:**
- Upload-plan API with no network I/O.
- Single-server hashtree upload action.
- Multi-server hashtree upload/mirror action.
- Immutable `htree://<nhash>/<path>` resolve/download/list APIs.
- Progress callbacks, caller-approved server policy hooks, timeout/signal propagation, and auth/payment callback propagation.
- Action tests with existing fetch mock and mock server patterns.

**Likely files:**
- `src/actions/hashtree.ts`
- `src/actions/index.ts`
- `tests/actions/hashtree.test.ts`
- `tests/mock-servers.ts`

**Research before planning:**
- Inspect `src/actions/upload.ts` fallback `PUT /upload` header behavior before relying on bulk chunk/manifest uploads.

**Success Criteria:**
- A fixture directory can be uploaded and then downloaded/listed by immutable reference through mocked Blossom servers.
- Existing auth/payment/timeout behavior is preserved through option propagation.
- Keys are never included in server request URLs or headers.

## Phase 4: Mutable Roots And Visibility

**Goal:** Add BUD-18 mutable root workflows and all required visibility modes while keeping relay/NIP-44 behavior callback-injected.

**Deliverables:**
- Kind `30064` root event template helpers.
- Mutable `htree://<npub>/<tree-name>/<path>` parser/builder integration with root lookup callbacks.
- Latest-root selection rules for replaceable events.
- Public root support.
- Link-private root key support.
- Owner-private root support through injected NIP-44 callbacks.
- Optional read-only legacy compatibility if the current BUD draft still requires it.

**Likely files:**
- `src/helpers/hashtree-roots.ts`
- `src/helpers/hashtree-visibility.ts`
- `src/actions/hashtree.ts`
- `src/const.ts`
- `src/nostr.ts`
- `tests/helpers/hashtree-roots.test.ts`
- `tests/helpers/hashtree-visibility.test.ts`
- `tests/actions/hashtree.test.ts`

**Research before planning:**
- Re-check PR #107 for root event kind, tag names, visibility semantics, link-private key handling, owner-private NIP-44 expectations, and legacy compatibility requirements.

**Success Criteria:**
- Mutable root references resolve through callbacks without a bundled relay client.
- All three visibility modes are tested.
- Link and root keys remain local and are not sent to Blossom servers.

## Phase 5: Experimental Public Surface

**Goal:** Expose the feature coherently as experimental SDK API and verify the package is publishable.

**Deliverables:**
- Public `./hashtree` package export.
- `Hashtree` namespace export from `src/index.ts`.
- Action/helper barrel exports where appropriate.
- Public TypeScript types and TypeDoc comments with experimental warnings.
- README or docs note pointing to BUD PRs and draft status.
- Changeset for the published experimental feature and new dependencies.
- Build/test verification.

**Likely files:**
- `src/hashtree.ts`
- `src/index.ts`
- `src/actions/index.ts`
- `src/helpers/index.ts`
- `package.json`
- `.changeset/*.md`
- `README.md`

**Success Criteria:**
- `pnpm test` passes.
- `pnpm build` passes and declaration files are emitted.
- Experimental status is clear in docs and exports.
- Changeset exists for release tracking.

## Dependency Notes

- Phase 1 can split into independent protocol plans after current spec vectors are confirmed.
- Phase 2 depends on Phase 1 codec and crypto decisions.
- Phase 3 depends on local tree correctness from Phases 1-2.
- Phase 4 depends on immutable hashtree resolution and upload/download behavior from Phase 3.
- Phase 5 should be last to avoid locking accidental API shapes.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Upstream BUD draft changes | API or vector churn | Re-check PRs before each phase; keep exports experimental. |
| CHK crypto misuse | Security failure | Keep arbitrary-key encryption out of API; vector and negative tests. |
| Non-canonical MessagePack | Interoperability failure | Centralize encoder; exact byte/hash vectors. |
| Recursive untrusted fetches | Security/performance issue | Enforce limits, visited sets, and caller-approved server policies. |
| Key leakage | Privacy failure | Strip key material before Blossom HTTP requests and relay callbacks. |
| Public API sprawl | Hard-to-change draft API | Export namespace/subpath late and mark experimental. |

## Next Action

Run `/gsd-plan-phase 1` to plan Protocol Foundations.

---
*Roadmap created: 2026-07-25*
