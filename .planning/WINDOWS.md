---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-12T15:49:45.024Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | .changeset/curly-items-grow.md |  | Added repository-required Changeset for the new public Hashtree entrypoint | open |  | 2026-08-12T10:34:01.905Z |  |
| 2 | 02 | unrun-verify | tests |  | Repository-wide Chromium run stalled after seven unrelated suites; all browser-compatible Hashtree suites passed independently | open |  | 2026-08-12T15:49:45.024Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": ".changeset/curly-items-grow.md",
    "line": null,
    "description": "Added repository-required Changeset for the new public Hashtree entrypoint",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T10:34:01.905Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "tests",
    "line": null,
    "description": "Repository-wide Chromium run stalled after seven unrelated suites; all browser-compatible Hashtree suites passed independently",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T15:49:45.024Z",
    "resolved_at": null
  }
]
````
