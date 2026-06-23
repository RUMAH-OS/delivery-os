---
artifact: capability-health — contracts excluded from runnable set + v6 router wiring tokens
verify_status: verified
verdict: PASS
date: 2026-06-23
author: orchestrator
verifier: qa-test (independent)
author_ne_verifier: true
scope: >-
  delivery-os/templates/tools/capability-health.mjs — the namesFromManifest() change
  (contracts/.d.mts excluded from the runnable measured set; generalizes the former one-off
  admin-plos-seam-v1 filter), 3 new --self-test cases, and the WIRING tokens added for
  dispatch-route / knowledge-route. Re-verified independently on a non-prod checkout; no commit.
---

# VERIFY — capability-health: contracts de-measured + router wiring

Independent re-run of every claim. All commands used absolute paths; exit codes captured
WITHOUT piping (a piped `$?` returns the pipe's exit, not the command's).

## Verdict: PASS

The 3 INERT capabilities are resolved at the root, principled, not neutered:
- `inventory-properties-v1` (a projection-schema CONTRACT) and `inventory-properties-v1.d.mts`
  (its type face) are correctly removed from the *runnable* measured set — a contract is
  validated by import + drift, never "wired to run", so measuring it as wired-to-run was a
  category error that forced a permanent false INERT.
- The exclusion is by CATEGORY (`m.contracts` dropped entirely), so the old one-off
  `admin-plos-seam-v1` special case is genuinely obsolete (it is now excluded as a contract).
- Nothing runnable was dropped: all real tools + skills remain measured.

## Criteria

### C1 — validate-the-validator self-test (exit 0, all cases incl. 3 new) — PASS
`node c:\Users\brian\RUMAH\delivery-os\templates\tools\capability-health.mjs --self-test`
REAL_EXIT=0. 9/9 PASS, including the 3 new:
```
PASS  manifest: contracts excluded from runnable set (got x,learning-review, want x,learning-review)
PASS  manifest: .d.mts type-face never measured (got empty, want empty)
PASS  manifest: dispatch-route tool stays in runnable set (got dispatch-route, want dispatch-route)
```
The 3 new cases assert exactly the three behaviors at issue: contracts excluded, the `.d.mts`
type-face never measured, and a genuine tool (dispatch-route) is NOT collateral-dropped.

### C2 — live gate on Admin (REAL exit 0, no inventory-properties* rows, no INERT/FAIL) — PASS
`node ...capability-health.mjs --project c:\Users\brian\RUMAH\rumah-admin`
Real exit verified unpiped (run, then `echo $?` on a separate invocation to /dev/null): **0**.
12 capabilities measured; the dispatch-route row reads:
```
[ALIVE  ] dispatch-route     — wired: .github/workflows/ci.yml (dispatch-route)
PASS: every measured capability is wired-to-run (ALIVE) in this project.
```
No `inventory-properties-v1` or `inventory-properties-v1.d.mts` row present. No INERT, no FAIL.
(`knowledge-route` reads MISSING — not in Admin's INHERITED.json — which is NOT a failure
condition; only INERT/REGRESSED fail the gate. Correct behavior.)

### C3 — principled, not neutered — PASS
- Read contract headers: `contracts/inventory-properties-v1.mjs` is a zero-dep projection
  VALIDATOR (`export function validateProperty…`, `PROPERTY_V1_KEYS`); `.d.mts` is a pure
  type face (`export interface PropertyV1…`); `admin-plos-seam-v1.mjs` is a zero-dep per-event
  contract validator. None has a CLI / `process.argv` / `--self-test` entrypoint — none is
  wired-to-run. Excluding them is correct, not a bypass.
- `namesFromManifest` still INCLUDES every real tool from os-foundation.manifest.json:
  os-inherit, seam-gate, lifecycle-gate, workflow-gate, experience-gate, skill-frontmatter,
  skill-route, agent-frontmatter, agent-route, knowledge-route, dispatch-route — plus the
  skill learning-review. Verified against the live Admin run (all 12 present in the table).
- `admin-plos-seam-v1` no longer appears as a special case in code (only in an explanatory
  comment). Confirmed by grep: it is excluded purely because it is a contract.

### C4 — diff proves the change can only REMOVE measured names (no new INERT possible) — PASS
git diff vs HEAD of the validator:
- OLD: `[...(m.tools), ...(m.contracts)].map(...).filter(n !== "admin-plos-seam-v1")` + skills.
- NEW: `(m.tools).map(...)` + skills (contracts dropped entirely).
Net delta to the measured name set: contracts removed (inventory-properties-v1,
inventory-properties-v1.d.mts, admin-plos-seam-v1). Skills were already measured in OLD code.
Therefore the change can only DROP names — it is mathematically impossible for it to introduce
a new INERT into any project.

### C5 — no collateral on other inheriting projects — PASS (with noted pre-existing state)
Two sibling projects inherit (have `.claude/os/INHERITED.json`): property-lead-os, rumah-website.
Both exit 1 on capability-health — BUT every INERT there is a TOOL (seam-gate, lifecycle-gate,
workflow-gate, skill/agent gates, dispatch-route, learning-review) that is un-wired-in-CI in
those repos. None is a contract. These INERTs are pre-existing (those repos have not wired the
gates into CI) and are present in OLD code identically — they are NOT caused by this change
(see C4). No `inventory-properties-v1*` row appears in either, and no row newly flipped to
INERT because of contract exclusion. No demo-app exists under delivery-os to test.

## Concerns
- None blocking. The Admin health-snapshot.json currently lacks `os-inherit` and
  `dispatch-route` rows while live now reads both ALIVE; on the next `--write-snapshot` these
  register as MOVED (improvement), never REGRESSED. Informational only.
- property-lead-os / rumah-website failing capability-health is a PRE-EXISTING, separate gap
  (gates inherited but not wired into their CI) — out of scope for this slice, not a regression.
