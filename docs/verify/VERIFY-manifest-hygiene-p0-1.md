# VERIFY — manifest-hygiene-p0-1

```yaml
slice: "manifest-hygiene-p0-1 — remove dangling goal-progress.mjs (F3) + register governance-engine as 2nd vendorable engine (F2)"
author: Builder
verifier: qa-test (independent — did NOT author this change)
verified_at: 2026-06-30T01:20Z
independence_basis: recorded-distinct-invocation
machine_probe: "node templates/tools/os-inherit.mjs engine-check --from . --into <tmp>"
verify_status: verified
```

## Verdict: PASS (verified)

Sync is **unblocked**, the **governance-engine is manifested + sha-recorded + drift-gated** (fail-closed
on a non-vendored consumer), and the **workflow-engine path is provably unchanged** (byte-identical
engine-check output under HEAD's prior manifest vs the fixed manifest, except the one new governance line).
`check-os-drift` is clean. The single file changed for this slice is the manifest. One scope caveat is
recorded under Criterion 5 (a co-resident, unrelated `CLAUDE.md` edit) — it does not touch the tested
machinery and is drift-clean, so it does not invalidate this slice.

## Code under test
`capabilities/os-foundation.manifest.json` — F3 removed dangling `templates/tools/goal-progress.mjs` from
`tools[]`; F2 added a 2nd `engines[]` entry `governance-engine` (source `templates/governance-engine`,
into `.claude/os/governance-engine`, record `INHERITED-governance-engine.json`, ddlParity canonicalDir
`templates/governance-engine/migrations`). `templates/tools/os-inherit.mjs` was NOT changed
(`git status` clean) — confirmed already multi-engine via `man.engines || []`.

## Execution evidence

| # | Criterion | Probe (run for real) | Result | Status |
|---|---|---|---|---|
| 1 | F3 — dangling source gone, sync unblocked | `ls templates/tools/goal-progress.mjs` → absent; `grep` manifest → not present; `node os-inherit.mjs sync --from . --into <tmp>` | sync **exit 0**, vendored 56 files + reached engine vendor loop ("engine workflow-engine … 27 file(s)", "engine governance-engine … 45 file(s)"). Under HEAD's PRIOR manifest the same sync **aborted exit 2**: `manifest source missing: templates\tools\goal-progress.mjs`. `goal-init.mjs`/`goal-stop.mjs`/`progress-stall.mjs` still on disk AND in manifest. | PASS |
| 2 | F2 — governance manifested + sha-recorded + drift-gated | `engine-check --from . --into <tmp>` on (a) bare sync, (b) fully-vendored install, (c) non-governance consumer | Sync generated BOTH `INHERITED-engine.json` AND `INHERITED-governance-engine.json`. engine-check reports **2 engine(s) · 72 installed engine file(s)**. On a fully-vendored install (both engines vendored + `engine.config.json` declaring the vendored-verbatim migrations) → **PASS, exit 0** ("structurally equivalent … canonical engine migration set"). On `examples/engine-demo-app` (governance NOT vendored) it **fails closed**: `MISSING RECORD: .claude/os/INHERITED-governance-engine.json for engine "governance-engine"`. Into-paths distinct: `.claude/os/engine` ≠ `.claude/os/governance-engine` (no collision). | PASS |
| 3 | workflow-engine UNCHANGED | `engine-check --into examples/engine-demo-app` under fixed manifest vs HEAD's prior manifest (git show HEAD → temp swap → restore) | PRIOR manifest: `1 engine(s)` + 4 STALE INSTALL (approvals-route.ts, engine.ts, handlers.ts, workflow-route.ts) for `engine="workflow-engine"`. FIXED manifest: `2 engine(s)` + the **same 4 STALE INSTALL** + **only one new line** (governance MISSING RECORD). The 4 STALE INSTALL are **PRE-EXISTING** (reproduced under HEAD) and NOT introduced by this change; workflow-engine output byte-identical. Manifest restored to exact sha `2aa309b4…`. | PASS |
| 4 | check-os-drift clean | `node templates/tools/check-os-drift.mjs` | `drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk.` **exit 0**. | PASS |
| 5 | Scope | `git status` / `git diff` | `os-inherit.mjs` NOT modified (clean). Deferred items NOT touched: `docs/verify/VERIFY-goal-delta-gate.md` not in diff; the pre-existing `engine-demo-app` workflow staleness untouched; consumer re-vendor not done. Engine source dirs (`templates/governance-engine/`, `examples/finance-os-demo/`) are untracked **prerequisites** the F2 entry points at (their presence is required, not a defect). **CAVEAT:** a co-resident, unrelated `CLAUDE.md` edit (the "infrastructure-agnostic core / Repository Principle" invariant, dated 2026-06-30) is also in the working tree — separate slice, does NOT touch the manifest/os-inherit/engine machinery, and is drift-clean. So "ONLY the manifest changed" is not literally true at the tracked-tree level. | PASS (with caveat) |

## Probe outputs (verbatim, key lines)

F3 — prior-manifest sync abort vs fixed-manifest unblock:
```
# PRIOR (HEAD) manifest
os-inherit: manifest source missing: templates\tools\goal-progress.mjs   (exit 2)
# FIXED manifest
os-inherit sync · engine "workflow-engine" · vendored 27 file(s) -> .claude/os/engine (record .claude/os/INHERITED-engine.json)
os-inherit sync · engine "governance-engine" · vendored 45 file(s) -> .claude/os/governance-engine (record .claude/os/INHERITED-governance-engine.json)
(exit 0)
```

F2 — fully-vendored install PASS:
```
os-inherit engine-check · OS v5.0-185-g5a6c3d8 · 2 engine(s) · 72 installed engine file(s)
PASS: every installed engine is byte-current with canonical (no local edit, not stale) AND the applied DDL is structurally equivalent to the canonical engine migration set.   (exit 0)
```

F2 — fail-closed on non-governance consumer (engine-demo-app):
```
os-inherit engine-check · ... · 2 engine(s) · 27 installed engine file(s)
FAIL: 5 engine drift/parity violation(s):
  - STALE INSTALL: .claude/os/engine/approvals-route.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/engine.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/handlers.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/workflow-route.ts ... engine="workflow-engine"
  - MISSING RECORD: .claude/os/INHERITED-governance-engine.json for engine "governance-engine" (run `os-inherit sync`)   (exit 1)
```

Criterion 3 — same consumer under PRIOR manifest (proves the 4 are pre-existing / workflow unchanged):
```
os-inherit engine-check · ... · 1 engine(s) · 27 installed engine file(s)
FAIL: 4 engine drift/parity violation(s):
  - STALE INSTALL: .claude/os/engine/approvals-route.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/engine.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/handlers.ts ... engine="workflow-engine"
  - STALE INSTALL: .claude/os/engine/workflow-route.ts ... engine="workflow-engine"   (exit 1)
```

Criterion 4 — `check-os-drift.mjs`: `drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk.` (exit 0)

## Findings (non-blocking)

- **OBSERVATION (scope, low):** the working tree contains an unrelated `CLAUDE.md` edit (Repository
  Principle invariant) alongside the manifest. It is a different slice, does not affect the engine
  machinery, and is drift-clean. Recommend committing it separately so the manifest-hygiene slice lands
  as a single-file change. Not a defect in the manifest change itself.
- **PRE-EXISTING (not this slice):** `examples/engine-demo-app` is STALE for workflow-engine (4 files) and
  has NOT vendored governance-engine — both correctly deferred per the sprint scope (consumer re-vendor).

## Method / independence

Independent of the engineer's tests: I ran `os-inherit sync`, `engine-check`, and `check-os-drift`
directly, into fresh `mktemp` installs and against the two `examples/` consumers, and reproduced the
pre-fix behavior by temporarily restoring HEAD's manifest (`git show HEAD:…`) and then restoring the
working copy byte-for-byte (sha `2aa309b4…` verified before and after). No implementation file was
modified by this verification.
