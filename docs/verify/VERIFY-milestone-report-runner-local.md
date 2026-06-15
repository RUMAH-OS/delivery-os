---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — milestone-report runner (v6 post-milestone verification trio)

Independent verification (author != verifier) of
`templates/tools/milestone-report.mjs`, which combines the verification trio
(capability-health, agent-health, founder-experience) into one permanent
post-milestone report with a single fail-closed OVERALL VERDICT.

No production code was changed. All fixtures were temp-only and deleted; the
only git change in the tree is the untracked runner under test (authored by the
build session). No tracked file modified (`git status --porcelain` confirmed).

## Verdict: VERIFIED

All five acceptance criteria hold. The two load-bearing criteria — verdict
logic (#2) and fail-closed propagation (#4) — both pass against the REAL module
and a REAL subprocess failure.

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `--self-test` exits 0 | PASS |
| 2 | `overallVerdict` truth table (imported from real module) + import-safe | PASS (load-bearing) |
| 3 | Happy path against `../rumah-admin` | PASS |
| 4 | Fail-closed: INERT capability-health → VERDICT FAIL, exit 1 | PASS (load-bearing) |
| 5 | agent-health can never be the sole cause of exit 1 | PASS |

## Criterion 1 — self-test → exit 0

`cd delivery-os && node templates/tools/milestone-report.mjs --self-test`

All 5 internal cases PASS; process exit 0:

```
milestone-report --self-test (prove the verdict logic):
  PASS  cap ok, exp skipped → PASS
  PASS  cap ok, exp ran+passed → PASS
  PASS  cap FAIL (exp skipped) → FAIL
  PASS  cap FAIL (exp passed) → FAIL
  PASS  cap ok, exp ran+failed → FAIL
PASS: overallVerdict() is correct on all known cases — fail-closed logic holds.
EXIT=0
```

## Criterion 2 (load-bearing) — verdict truth table + import-safety

A separate test module `import { overallVerdict }` from the real file (via an
absolute `file://` URL — the module is import-safe) and asserted the full table.
All five rows correct, and importing did NOT print the `MILESTONE REPORT`
banner — the `isMain` guard (line 169–170) holds, so importing does not auto-run
the report.

| Input | Expected | Got |
|-------|----------|-----|
| `{capOk:true,  expRan:false}`            | PASS | PASS |
| `{capOk:true,  expRan:true, expOk:true}` | PASS | PASS |
| `{capOk:true,  expRan:true, expOk:false}`| FAIL | FAIL |
| `{capOk:false, expRan:false}`            | FAIL | FAIL |
| `{capOk:false, expRan:true, expOk:true}` | FAIL | FAIL |

Result: `TRUTH-TABLE OK`, exit 0, no auto-run banner.

The verdict function (lines 45–49) reads ONLY capability + experience:
`if (!capOk) return "FAIL"; if (expRan && !expOk) return "FAIL"; return "PASS"`.

## Criterion 3 — happy path (`--project ../rumah-admin --skip-experience`)

Output contained every required marker; exit 0:

- capability-health: `9 capabilities` all `[ALIVE]` → `PASS: every measured
  capability is wired-to-run (ALIVE)` → `capability-health exit 0 (PASS)`.
  (Spec phrased this "9/9 ALIVE"; the tool prints "9 capabilities" with all 9
  rows ALIVE — same fact, no defect.)
- agent-health: `SUMMARY: 0 used · 8 idle(never-chosen) · selection=deterministic
  · parallel=yes (2 router batch(es)) · material=0% decisive` (reporting only)
- founder-experience: `SKIPPED (--skip-experience)`
- `═══ OVERALL VERDICT: PASS ═══` ; `EXIT=0`

## Criterion 4 (load-bearing) — fail-closed propagation

Temp project fixture: `.github/workflows/ci.yml` containing NO capability
wiring tokens, plus `.claude/os/INHERITED.json` listing seam-gate /
lifecycle-gate / workflow-gate. Inherited-but-unwired → capability-health
classifies them INERT and exits 1.

milestone-report against that fixture (`--skip-experience`):

```
  [INERT  ] seam-gate          — inherited: .../INHERITED.json · wired: NONE
  [INERT  ] lifecycle-gate     — inherited: .../INHERITED.json · wired: NONE
  [INERT  ] workflow-gate      — inherited: .../INHERITED.json · wired: NONE
FAIL: 3 INERT ...
→ capability-health exit 1 (FAIL — regression/INERT)
...
═══ OVERALL VERDICT: FAIL ═══
FAIL-CLOSED: capability-health regressed/INERT — the system is NOT verified as operating.
EXIT=1
```

A REAL child-process failure (capability-health exit 1) propagated through the
runner to OVERALL VERDICT: FAIL and `process.exit(1)`. Notably, in this same
run agent-health reported a healthy-looking `selection=deterministic` — yet the
verdict was still FAIL, confirming capability-health alone is decisive. Fixture
deleted after the run; real files untouched.

## Criterion 5 — agent-health is never the sole cause of failure

Two independent proofs:

1. Code proof. `overallVerdict` (line 45) takes only `{capOk, expRan, expOk}`;
   the call site (line 139) passes only those. The agent-health result `agent`
   (line 115) is captured for its `.out` summary only — `agent.code` is never
   read into the verdict. It is structurally impossible for agent-health to
   produce exit 1 on its own.

2. Dynamic proof. A temp project with capability-health wired (ALIVE → cap PASS)
   but agent-health in its worst state (NO `.claude/agents` dir, NO telemetry,
   NO selection log) still produced:
   `capability-health exit 0 (PASS)` → `OVERALL VERDICT: PASS` → `EXIT=0`.
   The empty/idle agent-health summary did not affect the exit code.

## Defects

None. (Minor wording note only: the spec's "9/9 ALIVE" appears as "9
capabilities" + 9 ALIVE rows — equivalent, not a defect.)

## Independence / hygiene

- Independence basis: recorded-distinct-invocation. Verifier ran the real
  binary and imported the real module in fresh subprocesses; did not reuse the
  author's self-test as the sole evidence (criteria 2, 4, 5 use independent
  harnesses / fixtures).
- All temp fixtures under `$TEMP/mr-*` and the verdict-test module were removed;
  `NO_TEMP_RESIDUE` confirmed.
- `git status --porcelain` shows only `?? templates/tools/milestone-report.mjs`
  (the untracked subject), no tracked-file drift. Not committed.
