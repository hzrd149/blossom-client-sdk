---
phase: 01
slug: packaging-boundary-and-protocol-contracts
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-12
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Consumer import → package export map | Consumer specifiers select published runtime and declaration targets. | Public module names and package artifacts |
| Runtime failure → public error | Arbitrary failures cross into SDK error objects. | Causes and narrowly declared diagnostic fields |
| Emitted root → module graph | Static edges determine root-consumer code and dependency cost. | Emitted ESM paths and bare specifiers |
| Repository → packed consumer | Build metadata and files cross into the publishable tarball. | Locally generated package archive |
| Test process → temporary filesystem | Verification creates loaders, sentinels, and extracted packages. | Test-owned temporary files and subprocess output |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `package.json` exports | high | mitigate | Exact and wildcard mappings target emitted `lib/hashtree` files; build and packed-package tests prove target existence and resolution. | closed |
| T-01-02 | Information Disclosure | `src/hashtree/errors.ts` | high | mitigate | Constructors copy only cause, operation, path, limit, and actual; focused tests reject arbitrary context retention and serialization. | closed |
| T-01-03 | Denial of Service | Public declarations | medium | mitigate | Contracts use ES/Web types; emitted declarations pass a browser-oriented compile with Node types disabled and a Chromium import smoke test. | closed |
| T-01-04 | Spoofing | Error discrimination | low | accept | Class identity and class name are local-realm discriminators; cross-realm identity is outside the Phase 1 contract. | closed |
| T-01-05 | Tampering | Emitted graph walker | high | mitigate | Relative edges resolve explicitly, missing edges fail closed, cycles are bounded by a visited set, and Hashtree paths are rejected from the root graph. | closed |
| T-01-06 | Information Disclosure | Root package entry | high | mitigate | Separate namespace, fresh-process evaluation-sentinel, and transitive graph assertions verify root isolation. | closed |
| T-01-07 | Tampering | Packed tarball selection | medium | mitigate | The test parses `npm pack --json`, requires exactly one tarball, and validates exact extracted targets and self-reference imports. | closed |
| T-01-08 | Denial of Service | Temporary test resources | medium | mitigate | Tests create one bounded local archive and remove unique temporary directories in `finally`. | closed |
| T-01-09 | Elevation of Privilege | System `tar` subprocess | low | accept | Only a locally generated repository archive is extracted into a unique test-owned temporary directory. | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-04 | Cross-realm error identity is outside the documented local-realm class contract. | Phase plan | 2026-08-12 |
| AR-01-02 | T-01-09 | Archive input is local and extraction is confined to a unique disposable directory. | Phase plan | 2026-08-12 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-12 | 9 | 9 | 0 | Codex orchestrator, ASVS L1 artifact verification |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-12
