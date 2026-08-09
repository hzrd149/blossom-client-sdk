# Pitfalls Research

**Domain:** Portable TypeScript client SDK for BUD-15/16/17/18 Hashtrees
**Researched:** 2026-08-09
**Confidence:** MEDIUM — exact protocol hazards come from the primary draft PR heads and vectors; the drafts are not yet merged standards and may change.

## Critical Pitfalls

### Pitfall 1: Implementing “AES-GCM encryption” but not the exact CHK construction

**What goes wrong:** Ciphertext cannot interoperate or, worse, nonce reuse destroys AES-GCM security. Typical byte-level errors are using the plaintext hash directly as the AES key, treating the ASCII HKDF salt/info as hex, using a random or prefixed nonce, separating/reordering the 16-byte tag, hashing plaintext for the Blossom address, or accepting an arbitrary caller key with the zero nonce.

**Why it happens:** Crypto APIs expose general AES-GCM/HKDF primitives while BUD-15 defines one narrow construction: `chk_key = SHA256(plaintext)`; HKDF-SHA256 with ASCII salt `hashtree-chk` and info `encryption-key`; 32-byte output; a 12-byte all-zero nonce; `ciphertext || 16-byte tag`; `blob_hash = SHA256(ciphertext)`. WebCrypto also returns ciphertext and tag together, while other libraries may expose them separately.

**How to avoid:** Keep encryption key derivation internal. Do not accept an encryption key or nonce from writers. Specify all bytes explicitly with `Uint8Array` and `TextEncoder`; set the GCM tag length explicitly; expose the CHK key and ciphertext hash as distinct branded concepts. Encrypt every BUD-17 chunk independently from that chunk's plaintext.

**Warning signs:** An encrypt API accepts `key` or `iv`; empty/`hello` vectors differ; ciphertext length is not plaintext length + 16; encrypted uploads use the plaintext hash; Node and browser produce different bytes.

**Verification:** Match both official BUD-15 vectors exactly in Node 18/20/22 and Chromium. Add negative tests for altered ciphertext, tag, blob hash, CHK key, HKDF salt/info, and a writer-supplied key. Assert upload URLs and `X-SHA-256` use the ciphertext hash.

**Phase to address:** BUD-15 cryptographic primitives, before manifests or storage integration.

---

### Pitfall 2: Treating AES-GCM authentication as complete CHK verification

**What goes wrong:** A blob can decrypt under a key derived from a supplied value without proving that value is actually `SHA256(plaintext)`. Skipping the ciphertext-address check also permits a server response that is valid ciphertext but not the requested Blossom object.

**Why it happens:** Successful AEAD decryption feels like sufficient integrity. BUD-15 explicitly requires two additional checks: `SHA256(ciphertext) == blob_hash` before decryption and `SHA256(plaintext) == chk_key` afterward.

**How to avoid:** One decrypt entrypoint must execute the full ordered pipeline and return no plaintext until all checks pass. Do not expose or internally use an “unchecked decrypt” on resolution paths. Collapse failures to a typed invalid-blob/decryption error without leaking partial plaintext.

**Warning signs:** Tests only flip the GCM tag; a decrypt function does not receive the expected blob hash; callers can obtain plaintext before final hashing; comments call either hash check “redundant.”

**Verification:** Independently corrupt expected hash, ciphertext, tag, and key; all must reject. Instrument a streaming consumer to prove no plaintext chunk is yielded before the enclosing CHK record authenticates.

**Phase to address:** BUD-15 cryptographic primitives and reinforced in BUD-17 streaming reads.

---

### Pitfall 3: Leaking bearer keys through URLs, requests, logs, events, or caches

**What goes wrong:** `k` in `blossom:`/`htree:` and keys embedded in manifests or `nhash` grant decryption. Forwarding them in Blossom query strings, generic HTTP URLs, error messages, analytics, cache keys, or public mutable-root fields exposes the tree. Public parent manifests also reveal child keys, names, sizes, and structure.

**Why it happens:** URI parsers commonly preserve the original search string when constructing fetch URLs; diagnostic objects stringify complete references; caches key by URI; developers mistake encrypted child blobs for secrecy of the directory manifest.

**How to avoid:** Parse capability material into a non-serializing secret type and construct Blossom requests solely from validated ciphertext hashes and configured server origins. Redact `k`, `key`, `encryptedKey`, `selfEncryptedKey`, and `selfEncryptedLinkKey` in errors/debug output. Encrypt parent manifests when structure or embedded keys are private. Document CHK equality leakage and confirmation attacks for guessable plaintext.

**Warning signs:** `fetch(reference.toString())`; server mocks observe query `k`; telemetry snapshots contain full `nhash`; public manifest fixtures contain real child keys; cache inspection reveals capability URLs.

**Verification:** Request-spy tests assert no secret appears in URL, headers, or body sent to Blossom. Snapshot redaction tests cover thrown errors and debug state. Visibility integration tests inspect published event tags for each mode.

**Phase to address:** URI/identifier primitives, then BUD-18 visibility integration; re-audit during client/cache work.

---

### Pitfall 4: Relying on MessagePack library defaults instead of the canonical profile

**What goes wrong:** Semantically identical manifests hash differently across runtimes or implementations. Map insertion order, locale sorting, UTF-16 comparison, non-minimal integer widths, encoding hashes/keys as strings or arrays, optional `undefined`, and unsorted nested metadata all change bytes.

**Why it happens:** MessagePack itself does not make arbitrary object serialization canonical. JavaScript's default string sort compares UTF-16 code units, not the required UTF-8 byte sequence; libraries differ in integer and binary choices.

**How to avoid:** Build a dedicated canonical encoder, not `encode(userObject)`. Emit root fields exactly `l,t`; link fields exactly `h,k,m,n,s,t` with absent fields omitted; recursively sort metadata map keys by unsigned UTF-8 bytes; sort directory entries the same way; require minimal integer encodings and MessagePack bin for 32-byte values. Validate metadata as finite JSON-compatible data before encoding.

**Warning signs:** Code spreads objects into encoder input; uses `localeCompare`; canonicalization exists only at the root; `Uint8Array` round-trips as an array; hashes change after decode/re-encode; negative or unsafe JS integers appear in sizes.

**Verification:** Exact BUD-16 and BUD-17 hex vectors; adversarial names where UTF-16 and UTF-8 ordering differ; randomized insertion-order property tests; nested metadata key-order tests; cross-check encoded bytes and decoded objects with the reference implementation.

**Phase to address:** BUD-16 canonical encoding, before BUD-17 builders and commits.

---

### Pitfall 5: Permissive decoding creates ambiguous or unsafe trees

**What goes wrong:** Duplicate names, extra root fields, malformed hashes/keys, invalid sizes, unknown types, named file/fanout links, or invalid metadata are silently coerced. Different readers then resolve the same bytes differently, and filesystem-like APIs may materialize attacker-chosen paths.

**Why it happens:** Decoders tend to be liberal and TypeScript types disappear at runtime. Mapping an unknown type to a raw blob seems forward-compatible but is explicitly forbidden.

**How to avoid:** Decode untrusted bytes to `unknown`, then validate exact root shape, field types/lengths, safe non-negative integers, per-node allowed link types, required/forbidden names, and metadata constraints. Reject unknown node/link types with a distinct unsupported-type error. Validate the complete directory for duplicate names before listing or resolving any entry.

**Warning signs:** Type assertions directly after decode; `switch` has a default blob branch; duplicate handling uses last-write-wins `Map`; validation only touches the selected path; extra root fields survive re-encoding.

**Verification:** Mutation/fuzz corpus for every field and node/link combination; duplicate names must fail even when the requested entry is unrelated; unsupported `t` must never fetch or materialize content; decoded structures should be immutable or defensively copied.

**Phase to address:** BUD-16 decoder/validator, extended with BUD-17 structural rules.

---

### Pitfall 6: Path decoding reintroduces separators or traversal segments

**What goes wrong:** Decoding the whole pathname before splitting turns `%2F` inside a tree name or entry into a separator. Empty segments, malformed escapes, `%00`, `.`, `..`, backslashes, or platform normalization can create ambiguous lookup or escape a target directory when materialized.

**Why it happens:** `URL.pathname`, `decodeURIComponent`, and Node filesystem conventions invite whole-path normalization. The protocol requires splitting first, then decoding each logical segment independently and matching exact manifest names.

**How to avoid:** Implement one protocol path parser shared by URI and tree APIs. Strip query/fragment structurally, split encoded path on literal `/`, strictly percent-decode each segment once, validate resulting names with BUD-16 rules, and never apply OS path normalization. Keep materialization out of core; any adapter must join beneath a fixed root and re-check containment.

**Warning signs:** `decodeURIComponent(url.pathname).split('/')`; `path.normalize` in portable core; acceptance of `%2e%2e`, malformed `%`, NUL, or empty directory names; a tree name containing encoded slash resolves as two segments.

**Verification:** Table-driven cases for encoded slash in tree names, double encoding, malformed UTF-8/percent sequences, query/fragment exclusion, `.`, `..`, NUL, backslash, repeated slash, and Unicode. Assert no invalid path initiates a fetch.

**Phase to address:** BUD-16 path primitives and BUD-18 URI parsing, before filesystem-like operations.

---

### Pitfall 7: Recursive traversal trusts structure and has no global work budget

**What goes wrong:** Cycles, repeated subgraphs, deeply nested manifests, huge metadata, dishonest sizes/counts, and high fanout cause infinite recursion, stack overflow, excessive network traffic, memory exhaustion, or decompression-like amplification. Per-node `174` checks alone do not bound the whole traversal.

**Why it happens:** Content addressing prevents undetected byte mutation, not malicious graph topology. Convenient recursive functions hide cumulative work and parallel fanout.

**How to avoid:** Use iterative traversal with a per-operation budget covering manifest bytes, manifest count, link count, depth, total fetched bytes, declared plaintext bytes, and concurrency. Track the active ancestry set for cycles and optionally a visited set for repeated nodes. Check budgets before scheduling fetches or allocating output; reject integer overflow and inconsistent aggregate sizes.

**Warning signs:** Recursive `await resolve(child)` with no context object; `Promise.all` over attacker-controlled links; limits are optional/unbounded defaults; `Blob` allocation uses declared size; repeated hashes refetch indefinitely.

**Verification:** Fixtures for self-cycle, two-node cycle, maximum-depth chain, diamond graph, 175-link node, enormous metadata, huge/overflowing `s`, and budget exceeded mid-stream. Assert bounded fetch count and cancellation of outstanding work.

**Phase to address:** BUD-17 traversal and resource limits; carry the budget into BUD-18 resolution and client APIs.

---

### Pitfall 8: Chunking and fanout are readable but non-canonical or structurally under-validated

**What goes wrong:** Writers produce different roots by using decimal 2 MB instead of 2 MiB, chunking small files unnecessarily, grouping nonconsecutive links, exceeding 174, naming internal links, using `t=2` for new fanout, or calculating parent sizes incorrectly. Readers may expose internal fanout nodes, trust bogus `first`/`last`, or concatenate links in a reordered collection.

**Why it happens:** Chunking is mistaken for a performance detail. In BUD-17, `2097152`, `174`, ordering, node types, size sums, and fanout bounds define canonical identity and safe lookup.

**How to avoid:** Centralize constants. Preserve file-manifest array order; group consecutive links bottom-up; emit new fanout only as `t=3`; omit `n` internally; calculate positive `count`, UTF-8-sorted `first/last`, non-overlapping adjacent ranges, and recursive `s`. Flatten fanout for public listing while preserving a normal user entry named `_chunk_0` in `t=2`.

**Warning signs:** Configurable chunk size in canonical writer; `2_000_000`; object/map used for file chunks; internal `_chunk_*` names from older drafts emitted by new writers; binary search uses unvalidated bounds.

**Verification:** Boundary tests at 0, 1, 2 MiB, 2 MiB+1, 174 and 175 links, and multi-level fanout; exact vectors; compare roots with reference implementation; reject missing/invalid/overlapping bounds and named `t=3` links; verify `_chunk_0` remains visible in an ordinary directory.

**Phase to address:** BUD-17 canonical builders and traversal.

---

### Pitfall 9: “Streaming” still buffers the whole file or emits unauthenticated bytes

**What goes wrong:** The SDK reads every chunk before producing output, hashes via `Blob.arrayBuffer()`, or assembles a `Blob` inside the streaming path. Memory becomes proportional to file size. Conversely, streaming plaintext out of a single AES-GCM record before tag verification exposes unauthenticated data.

**Why it happens:** WebCrypto AES-GCM is whole-record, existing hashing already duplicates blob memory, and the convenience `Blob` API can accidentally become the shared implementation.

**How to avoid:** Make the async stream/`ReadableStream` path primary. Fetch one or a bounded number of independently addressed BUD-17 chunks, verify ciphertext hash, decrypt/authenticate the complete chunk, verify its plaintext hash and declared size, then yield it in manifest order. Build the convenience `Blob` by consuming the stream and clearly document its memory cost.

**Warning signs:** Stream implementation calls `readFile`; `Promise.all(chunks)`; peak memory approximates file size multiple times; consumer receives bytes before a corrupt tag fails; abort does not cancel fetches.

**Verification:** Large synthetic file with instrumentation for maximum in-flight chunks/bytes; corrupt middle chunk must stop before yielding that chunk; ordering under varied network latency; cancellation closes readers and aborts active fetches; browser suite as well as Node.

**Phase to address:** BUD-17 streaming read API and storage integration.

---

### Pitfall 10: Mutable-root selection and visibility semantics are only partially implemented

**What goes wrong:** A client chooses whichever relay event arrives last, ignores signature/author/`d`, fails the equal-`created_at` event-ID tie-break, publishes obsolete kind `30078`, accepts malformed hash/key tags, or conflates public, link-private, and owner-private roots. Root state then diverges across relays or secrets become unrecoverable/exposed.

**Why it happens:** Relay delivery order is nondeterministic and visibility tags look like optional metadata. Link-private derivation (`encryptedKey XOR link_key`) and owner recovery via injected NIP-44 callbacks are distinct workflows.

**How to avoid:** Validate event signature through the injected contract or require callbacks to return verified events; filter author, kind, exact `d`, and tag cardinality/hex lengths. Publish kind `30064`; read `30078` only as compatibility. Reduce candidates by `(created_at, event id lexicographically)` independent of arrival order. Model visibility as a discriminated union and require cryptographically random 32-byte link keys; verify `keyId` when present.

**Warning signs:** root changes when relay response order changes; a generic tags dictionary drops duplicates; same API object permits contradictory visibility fields; tests cover only public roots; randomness is injectable nowhere for vectors.

**Verification:** Permute identical event sets and assert the same winner; equal-timestamp tie; wrong author/`d`/signature/kind/hash rejection; publish uses 30064; each visibility mode round-trips; wrong link key/keyId and NIP-44 failure reject; optional owner recovery variants are tested.

**Phase to address:** BUD-18 root events and visibility, before reactive subscriptions.

---

### Pitfall 11: Snapshot-query/subscription races and stale events corrupt reactive state

**What goes wrong:** An update published between initial query and subscription setup is missed; duplicate relay events are emitted repeatedly; older roots overwrite newer local/remote state; callbacks continue after unload; or a local optimistic commit is reported twice when echoed by a relay.

**Why it happens:** Async iterables do not define snapshot handoff, ordering, replay, cancellation, or deduplication by themselves. Multiple relays deliver duplicates and reorder events.

**How to avoid:** Define the injected subscription contract precisely. Prefer subscribe-first then query/backfill, feed both through one validated event reducer, dedupe by event ID, and apply the same replaceable-event ordering rule. Assign tree-instance lifecycle cancellation; close iterators on unload. Give updates stable origins/revisions and reconcile a relay echo of a local commit without regressing state.

**Warning signs:** query and subscription independently mutate root state; no `return()`/abort handling; every incoming event invalidates caches; arrival order decides state; tests use one relay and strictly increasing timestamps.

**Verification:** Deterministic race harness for event between subscribe/query, query/subscription duplicates, out-of-order and equal-time events, relay reconnect/replay, unload during pending `next()`, local publish echo, and subscriber backpressure/error behavior.

**Phase to address:** Reactive tree instances after root selection is stable.

---

### Pitfall 12: Cache and staged-mutation state cross root or commit boundaries

**What goes wrong:** Decoded nodes cached by path are reused after the mutable root changes; decrypted data is cached without key identity; caller mutations alter cached objects; staged changes leak into committed reads; failed commits partially advance the visible root; concurrent commits lose updates.

**Why it happens:** Paths are mutable names, while hashes are immutable identities. A convenient tree object tends to collapse remote base, staged overlay, committed root, and cache into one mutable structure.

**How to avoid:** Cache verified raw/decoded objects by content hash plus encryption context, and cache path resolution only under a root revision. Freeze or clone decoded values. Represent staging as an overlay against an explicit base root. Serialize commits per tree or reject concurrent commits; construct/upload children and manifests first, publish the new root last, then atomically advance local state. On publish failure retain a retryable staged state without claiming success.

**Warning signs:** cache key is pathname alone; remote root event leaves cache untouched; `commit()` clears staging before publish; two commits can run simultaneously; client returns internal manifest objects by reference.

**Verification:** Root A/root B same path tests; same ciphertext hash with wrong/missing key context; mutation of returned objects; upload or publish failure at each stage; concurrent edit/commit/remote-update matrix; unload wipes secrets and tree-local state.

**Phase to address:** Modular client state and caches, then explicit commit orchestration.

---

### Pitfall 13: Commit ordering creates dangling mutable roots or ambiguous conflict behavior

**What goes wrong:** Publishing the kind-30064 root before all referenced blobs are durably uploaded exposes a temporarily or permanently broken tree. Multi-server partial success may publish a root unavailable from intended servers. Concurrent remote advancement may be silently overwritten.

**Why it happens:** A Hashtree commit is not one atomic server transaction. Existing multi-server actions can return partial outcomes, while Nostr publication is another independent system.

**How to avoid:** Define commit as prepare/verify/publish/finalize: deterministically build the DAG, upload leaves before parents, require the configured durability policy, optionally verify availability, publish root last, then finalize local revision. Capture the base root and expose an explicit conflict policy (`fail`, intentional overwrite, or caller merge); do not silently merge filesystem operations.

**Warning signs:** Nostr publish occurs inside per-blob upload loop; root event exists before upload promises settle; partial server failures are discarded; `commit()` has no base revision or durability semantics.

**Verification:** Fault injection for every upload level and root publish; assert no root publish on failed durability requirement; retry is idempotent and produces identical bytes; simulated remote root advancement triggers declared conflict policy; partial server result remains observable.

**Phase to address:** Commit/storage orchestration after functional DAG builders and root events.

---

### Pitfall 14: The new subpath works from source but fails or bloats the published package

**What goes wrong:** Tests importing `src/hashtree` pass while `blossom-client-sdk/hashtree` points to absent/stale `lib` files, declarations are missing, or the root barrel accidentally imports hashtree code/dependencies. Node-only imports or `Buffer` globals break browsers.

**Why it happens:** This repository commits `lib/`, source tests do not exercise package exports, and TypeScript's DOM+Node types can mask runtime assumptions. A wildcard export or root re-export defeats module isolation.

**How to avoid:** Add an explicit `./hashtree` export with JS and declarations, never re-export it from `src/index.ts`, keep core on standard `Uint8Array`, WebCrypto-compatible primitives, Blob/streams, and injected callbacks. Avoid top-level optional imports. Test a packed/built artifact in Node and browser bundling conditions.

**Warning signs:** root import graph includes MessagePack/bech32/hashtree modules; use of `Buffer`, `node:crypto`, `process`, or Node streams in core; package smoke test is absent; clean build changes committed `lib` unexpectedly.

**Verification:** `pnpm build`; import built root and assert no hashtree exports; import built `./hashtree`; declaration-consumer compile; Node 18/20/22 tests and Chromium browser vectors; inspect packed files/export map; changeset for published behavior.

**Phase to address:** Establish packaging boundary in the first implementation phase; verify again at every release phase.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| General MessagePack object encoder | Less code | Noncanonical hashes and cross-language failure | Never for protocol writes |
| One recursive resolver without a budget object | Simple API | DoS, unbounded fetches, limits that cannot compose | Never for untrusted manifests |
| Path-keyed cache | Easy filesystem mental model | Stale reads after mutable-root changes | Only if scoped to an immutable root revision |
| Read-all implementation behind a stream facade | Quick demo | File-sized memory, late output, weak cancellation | Only in explicitly named `readFileBlob()` convenience path |
| Publish root after “some” server uploads | Lower latency | Dangling or under-replicated roots | Only under an explicit documented durability policy |
| Flatten Nostr callback/library types into SDK API | Faster integration | Relay-library coupling and bundle growth | Never; use narrow injected contracts |
| Treat draft compatibility as permissive coercion | Reads more inputs | Ambiguous semantics and security bypass | Only for explicitly specified legacy forms: kind 30078 read and raw 32-byte legacy `nhash` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Blossom fetch/upload | Address encrypted data by plaintext hash or append `k` | Address/request exact ciphertext hash; keep keys local |
| Multi-server upload | Ignore per-server partial failures during commit | Apply explicit durability threshold and expose results before root publish |
| Nostr query | Trust arrival order or malformed tags | Validate candidates and reduce by replaceable-event timestamp + lexicographically greatest ID tie-break |
| Nostr subscription | Query then subscribe with a gap | Subscribe-first/backfill or define cursor semantics; unify reduction and dedupe |
| NIP-44 callback | Assume successful decryption means correct root key | Validate recovered 32-byte key and then perform BUD-15/hash checks |
| URL API | Decode entire pathname | Split literal `/` first, decode/validate each segment once |
| MessagePack package | Assume deterministic option covers BUD profile | Own field emission, UTF-8 byte sorting, minimal integers, and binary types |
| WebCrypto | Assume all AES-GCM return formats match native libraries | Normalize `ciphertext || tag` bytes and test exact vectors cross-runtime |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parallel fetch of every link | Burst requests and memory spikes | Bounded scheduler shared across traversal | Malicious/high-fanout trees; even 174 links per node compounds recursively |
| Re-fetching shared manifests | Duplicate traffic in DAGs | Per-operation verified-hash memo plus instance cache | Repeated subtrees/diamond graphs |
| Linear fanout scan despite valid bounds | Many irrelevant manifest fetches | Validate `first/last`, then select candidate child | Directories above 174 entries, increasingly severe at multi-level fanout |
| Full-file hashing/assembly | Multiple full-size allocations | Independently verify/decrypt bounded chunks; separate Blob convenience | Files beyond available browser memory |
| Unbounded update queue | Increasing lag and retained roots | Backpressure/coalescing policy that preserves latest valid root | Slow UI consumer plus busy relay/replay |
| Rebuild whole DAG after one edit | Commit latency and upload churn | Structural sharing by content hash; rebuild ancestors only | Large/deep trees with frequent small edits |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Arbitrary key with zero GCM nonce | Catastrophic confidentiality/authentication break | Writer always derives key from exact plaintext; no override |
| Skipping either content hash check | Accept wrong-address or non-CHK plaintext | Enforce ciphertext hash before and plaintext hash after decrypt |
| Logging/caching bearer references verbatim | Capability disclosure | Secret-aware types, redaction, cache by hash/revision |
| Publishing child keys in unencrypted parent | Directory and data disclosure | Encrypt parent/root for private structures |
| Guessable plaintext under deterministic CHK | Equality and confirmation leakage | Document limitation; do not market CHK as semantic security for low-entropy secrets |
| Trusting declared sizes/counts | Allocation/DoS and misleading stats | Safe-integer validation, budgets, and recomputed aggregates |
| Following unverified link bytes | Content substitution | Hash every fetched object before decrypt/decode/use |
| Materializing protocol paths directly | Filesystem traversal/overwrite | Core stays virtual; adapters enforce containment and collision rules |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Plaintext default is visually indistinguishable from private mode | Users assume privacy | Expose explicit visibility/encryption status and capability-sharing warnings |
| Staged edits look committed | Data disappears on reload | Surface dirty state, base revision, commit progress, and failure status |
| Mutable URI presented as permalink | Shared content changes unexpectedly | Offer immutable `nhash` snapshot/copy-link action |
| Generic “not found” for all failures | Users retry when data is corrupt or key is wrong | Typed errors for missing root/blob, unsupported type, budget, hash, decryption, and conflict |
| `readFile` silently allocates huge Blob | Browser tab crashes | Streaming API first; size-aware warning/limit for Blob convenience |

## “Looks Done But Isn’t” Checklist

- [ ] **BUD-15:** Official empty and `hello` bytes match in Node and Chromium; both hash checks have negative tests.
- [ ] **Canonical manifests:** Tests vary object insertion order, Unicode name order, nested metadata keys, integer widths, and binary representation.
- [ ] **Validation:** Every malformed type/name/hash/key/size/fanout-bound combination fails before dependent fetch or presentation.
- [ ] **BUD-17 boundaries:** 2 MiB/2 MiB+1 and 174/175 cases plus multi-level file and directory roots match reference output.
- [ ] **Streaming:** Peak in-flight data is bounded, chunks remain ordered, corruption yields no bytes from the bad chunk, and abort cancels network work.
- [ ] **BUD-18 identifiers:** TLV `nhash`, exact legacy 32-byte payload, percent-encoding, query/fragment handling, and bearer-key redaction are covered.
- [ ] **Visibility:** Public, link-private, owner-private, owner-recovery variants, wrong key/keyId, and NIP-44 failure are tested.
- [ ] **Root ordering:** Relay arrival permutations and equal timestamps select the same event.
- [ ] **Commit:** Blobs/manifests meet durability policy before root publication; partial failure and retry preserve staged state.
- [ ] **Reactive lifecycle:** Snapshot/subscription gap, replay, dedupe, local echo, cancellation, unload, and backpressure semantics are tested.
- [ ] **Cache:** Root revision and encryption context scope all path/decode caching; returned objects cannot mutate cache internals.
- [ ] **Packaging:** Built `./hashtree` JS/types import successfully while root import neither exposes nor loads hashtree code.
- [ ] **Interoperability:** Round trips are compared with the Hashtree reference implementation, not only self-encoded/self-decoded tests.
- [ ] **Release:** Node 18/20/22, browser suite, build, packed export smoke, and Changeset all pass.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Noncanonical writer released | HIGH | Freeze writes, correct encoder, regenerate manifests/root references, publish migration guidance; old hashes cannot be rewritten in place |
| Bearer key leaked | HIGH | Re-encrypt affected root/children with new content-derived keys where plaintext changes or change confidentiality scheme; publish new root and treat old capability as permanently public |
| Dangling root published | MEDIUM | Upload missing content to required servers, verify hashes, or publish a newer valid root reverting to last complete DAG |
| Stale/poisoned cache | MEDIUM | Invalidate all path caches on root transition; discard unverified decoded entries; reload by immutable hash |
| Commit conflict | MEDIUM | Preserve staged overlay and both root IDs; let caller rebase/replay operations or explicitly overwrite |
| Traversal budget exceeded | LOW | Abort outstanding fetches, return typed limit error with counters, allow caller to opt into carefully higher finite limits |
| Subscription leak | LOW/MEDIUM | Abort iterator, clear listeners/queues/secrets, recreate tree instance from current validated snapshot |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Exact CHK construction | BUD-15 crypto primitives | Official vectors across Node/Chromium; API cannot accept arbitrary writer key/nonce |
| Complete decrypt verification | BUD-15 crypto primitives | Corruption matrix for ciphertext hash, tag, key, plaintext hash |
| Bearer-secret leakage | URI primitives + BUD-18 visibility + client cache | Fetch spies and redaction snapshots |
| Noncanonical MessagePack | BUD-16 codec | Exact vectors, adversarial Unicode/insertion order, reference cross-check |
| Permissive decoding | BUD-16 validation + BUD-17 extension | Fuzz/mutation corpus and fetch-before-validation assertions |
| Path confusion/traversal | BUD-16 paths + BUD-18 URI | Encoded-slash and malicious-segment table tests |
| Resource exhaustion/cycles | BUD-17 traversal | Bounded adversarial graph tests and cancellation |
| Incorrect chunk/fanout construction | BUD-17 builders | Boundary/multilevel vectors and structural rejection tests |
| Fake streaming | BUD-17 reads/storage | Peak-memory/in-flight instrumentation and corrupt-chunk behavior |
| Root/visibility ambiguity | BUD-18 roots | Candidate permutation plus all visibility mode tests |
| Subscription race/staleness | Reactive client state | Deterministic handoff/replay/unload harness |
| Cache/staging contamination | Modular tree client | Root/key isolation and failure-state matrix |
| Non-atomic distributed commit | Commit orchestration | Layered fault injection, durability and conflict tests |
| Broken/bloated package export | Initial packaging boundary + release | Built/packed subpath and root isolation smoke tests |

## Phase Research Flags

- **BUD-15 crypto:** deeper research required if WebCrypto is not the single portable implementation path; confirm exact tag handling in any fallback library.
- **BUD-16 codec:** deeper research required before choosing a MessagePack dependency; prove it permits manual canonical field/integer/bin control in both runtimes.
- **BUD-17 traversal:** threat-model and fix concrete default budgets before exposing untrusted resolution.
- **BUD-18 Nostr:** specify callback verification responsibility, tag cardinality, subscription handoff, and compatibility precedence before implementation.
- **Commit/client state:** write a state-machine contract for base root, staged overlay, upload durability, publication, remote conflict, and retry.
- **Release packaging:** standard pattern, but currently a known repository gap; add built-package smoke coverage early rather than at the end.

## Sources

- [BUD-15 primary draft PR #104](https://github.com/hzrd149/blossom/pull/104) — exact CHK construction, validation, security notes, and vectors (MEDIUM; primary draft, fetched 2026-08-09)
- [BUD-16 primary draft PR #105](https://github.com/hzrd149/blossom/pull/105) — canonical MessagePack, validation, paths, and vectors (MEDIUM; primary draft, fetched 2026-08-09)
- [BUD-17 primary draft PR #106](https://github.com/hzrd149/blossom/pull/106) — chunk/fanout constants, validation, traversal bounds, and vectors (MEDIUM; primary draft, fetched 2026-08-09)
- [BUD-18 primary draft PR #107](https://github.com/hzrd149/blossom/pull/107) — references, root selection, visibility, `nhash`, and safety rules (MEDIUM; primary draft, fetched 2026-08-09)
- [Project definition](../PROJECT.md) — milestone scope, runtime/API decisions, and explicit commit semantics (HIGH; local canonical project context)
- [Codebase concerns](../codebase/CONCERNS.md) — package-export drift, full-buffer hashing, multi-server orchestration, and optional dependency risks (HIGH; local code audit)
- [Testing patterns](../codebase/TESTING.md) — current Node/browser test surfaces and package-smoke gap (HIGH; local code audit)

---
*Pitfalls research for: blossom-client-sdk Hashtree support*
*Researched: 2026-08-09*
