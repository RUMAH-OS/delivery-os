---
slice: "repo-governance-auditor"
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: 2026-06-25
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/repo-governance-auditor.mjs --self-test"
---

# VERIFY — Slice repo-governance-auditor (Repository Governance Auditor)

## Verdict
**verify_status:** `verified`  ·  one line: zero-dep classifier passes its own G1–G10 self-test (exit 0), the
templates/ and .claude/ copies are byte-identical, merge is provably HUMAN-only (no rule action `"merge"`;
`decideMerge` imported, never auto-merges), the squash-merge regression guard holds (PR-state==MERGED → G1-SAFE
high even when absent from `git --merged`), only G1/G2 mutate and only behind `--apply-safe`, fail-closed when gh
is missing/unauthed, and a live `--repo` run produced a real read-only scoreboard mutating nothing.

> Honest limits (below): the LOGIC + the read-only scoreboard are verified. The live `--apply-safe` cleanup is
> NOT exercised here (no mutation performed, per instruction). The branch-side facts of a `--repo` run are
> sourced from the LOCAL cwd's git, not the remote repo — see Limit L1.

## Independence header  (Governance §3/§12)
- Verifier identity / invocation: independent-qa-subagent · distinct invocation · 2026-06-25
- Author identity (code under test): implementation-session(coordinated), uncommitted on branch
  `feat/repo-governance-capability`
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (verbatim runtime output)

| # | Command | Exit | Output (verbatim, trimmed) |
|---|---------|------|----------------------------|
| 1 | `node templates/tools/repo-governance-auditor.mjs --self-test` | 0 | `repo-governance-auditor --self-test PASS — G1–G10 fixtures classify correctly (incl. THE SQUASH-MERGE REGRESSION GUARD: a MERGED-PR branch absent from \`git --merged\` -> G1-SAFE high; cherry-equivalent -> G3-MEDIUM/NEEDS-APPROVAL; a '+' unmerged commit -> no finding), band split holds (SAFE:[G1,G2,G10] APPROVAL:[G3,G4,G5,G6,G7,G8] NEVER:[G9]), green-but-NOT-greenlit never reaches G5, a green+greenlit PR is never closed as superseded, and the merge gate is HUMAN-only (no rule action 'merge'; imported decideMerge never auto-merges).` |
| 2a | `node --check templates/tools/repo-governance-auditor.mjs` | 0 | `SYNTAX_OK` |
| 2b | `sha256sum templates/tools/… .claude/tools/…` | 0 | both `ef0d43b6a2cb1a9612a8ae919f9ac1981f14d060545243c693e78d88dfda6b18` — **byte-identical** |
| 3 | Read of file + `grep ^import` on imported `ci-release-orchestrator.mjs` | — | auditor imports only `node:child_process`, `node:url` + `./ci-release-orchestrator.mjs`; the orchestrator imports only `node:child_process`, `node:fs`, `node:path`, `node:url`. No third-party deps. No `shell:true`. All gh/git via `execFileSync`. |
| 7 | `node /tmp/failclosed.mjs` (stub io) | 0 | `NO_GH result: error \| msg: gh CLI not found on PATH …` ; `NO_AUTH result: error \| msg: gh is not authenticated — run \`gh auth login\`. Fail-closed …` ; `NO_GH applied: []  NO_AUTH applied: []` |
| 8 | `node templates/tools/repo-governance-auditor.mjs --json --repo RUMAH-OS/property-lead-os` | 0 | real scoreboard: `activePRs:7, softLimit:5, breach:true`; 3× G1 (SAFE) + G6 stale + G8 breach + 2× G4 consolidation; `applied: []` — **no mutation** (no `--apply-safe`) |
| L1 | `git branch -r` / `git branch -r --merged origin/main` in cwd | 0 | local delivery-os clone shows 9 remote branches (3 merged) — confirms branch facts come from the cwd's git, not the `--repo` remote |

## Acceptance criteria  (per the verification brief — PASS/FAIL + evidence)

| # | Criterion | Surface | Evidence | PASS/FAIL |
|---|-----------|---------|----------|-----------|
| 1 | `--self-test` PASS, exit 0 | running the tool | #1 | PASS |
| 2 | `node --check` clean; templates/ and .claude/ copies byte-identical | syntax + sha256 | #2a/#2b | PASS |
| 3 | Zero-dep (only `node:` builtins + gh/git via execFileSync, no `shell:true`) | code + imported module | #3 | PASS |
| 4 | HUMAN-ONLY merge invariant: no rule action `"merge"`; G5 is NEEDS-APPROVAL + only PRINTS `node merge-pr.mjs <n>`; `decideMerge` imported, never auto-merges | code + self-test asserts | #1, #3 | PASS |
| 5 | Squash-merge guard: `isMergedBranch` keys on PR-state==MERGED (high→SAFE delete), cherry/ancestry-only → medium (NEEDS-APPROVAL); self-test asserts MERGED-PR branch absent from `git --merged` → G1-SAFE | code + self-test asserts | #1, #3 | PASS |
| 6 | SAFE-only appliers: `--apply-safe` mutates ONLY G1 + G2, each guarded; NEEDS-APPROVAL / NEVER-AUTO execute nothing | code | #3 | PASS |
| 7 | Fail-closed: clear error when gh missing/unauthed, no mutation | running with stub io | #7 | PASS |
| 8 | Live `--repo` read-only run produces a real scoreboard and mutates nothing without `--apply-safe` | live gh against PLOS | #8 | PASS (PR side; branch-count caveat L1) |

## The load-bearing proofs

### Proof A — HUMAN-ONLY merge invariant (criterion 4)
- `GOVERNANCE_RULES` (lines 61–154): no entry has `action: "merge"`. G5 `merge-ready` is
  `band: "NEEDS-APPROVAL"`, `action: "surface-merge-command"` (lines 100–108).
- `classifyPR` for a green+greenlit PR pushes G5 with `command: \`node merge-pr.mjs ${pr.number}\`` (line 288) —
  it PRINTS the command, performs nothing.
- `decideMerge` is **imported** from `ci-release-orchestrator.mjs` (line 41) and used only via `isGreen` with
  `merge:false`, returning `"await-human"` (line 234) — never `"merge"`. It is not reimplemented.
- The applier router (lines 554–584) treats only G1/G2 as appliers; G5 falls in the NEEDS-APPROVAL branch which
  executes nothing.
- Self-test (#1) asserts: `GOVERNANCE_RULES.every(r => r.action !== "merge")`, `decideMerge(...).action ===
  "await-human"`, and `G5.band === "NEEDS-APPROVAL" && action === "surface-merge-command"`.
- **No path can merge or close non-superseded work.** VERDICT: HUMAN-ONLY merge invariant **HOLDS**.

### Proof B — squash-merge regression guard (criterion 5)
- `isMergedBranch` (lines 194–213) checks PR-state==MERGED FIRST → `{confidence:"high", via:"pr-state"}`; then
  ancestry `git branch -r --merged` → high `via:"git-merged"`; then `git cherry` all-`-` → `{confidence:"medium",
  via:"cherry"}`; otherwise not-merged. A single `+` (commit not upstream) disqualifies (line 207–208).
- `classifyBranch` (lines 259–270): high → G1 (SAFE delete); medium → G3 (NEEDS-APPROVAL).
- Self-test (#1) fixture `feat/squashed`: PR-state MERGED but `git --merged` EMPTY → `isMergedBranch` returns high
  via `pr-state`, and `classifyBranch` → G1/SAFE/high. The cherry fixture → G3/NEEDS-APPROVAL. The `+` fixture →
  no finding (fail-closed).
- `applyG1` refuses anything not `confidence === "high"` (line 500). **VERDICT: squash-merge guard HOLDS** —
  only HIGH-confidence merged branches are auto-deletable; cherry-equivalence is human-gated.

### Proof C — SAFE-only appliers (criterion 6)
- `applyG1` (497–506): rejects `rule !== "G1"`, rejects non-high confidence, rejects empty/protected branch
  (`main/master/develop/HEAD`).
- `applyG2` (508–514): rejects `rule !== "G2"`, rejects missing `supersededBy`; closes WITH a reopenable pointer
  comment.
- Router (554–584): `isApplier = rule === "G1" || rule === "G2"`; only fires when `opts.applySafe && !opts.dryRun`.
  G10 is SAFE band but has NO applier — printed only. NEEDS-APPROVAL → proposed/escalated, NEVER-AUTO → escalated;
  neither executes. On applier error → falls back to "propose" (fail-closed, no blind action).

## Surface statement
- Real surface: the executable tool (`--self-test` classifier fixtures) and a LIVE `gh` audit of
  `RUMAH-OS/property-lead-os`. Driven by direct `node` invocation, not by reading code alone.
- [x] No criterion was "verified" via a bypassing surface. Fail-closed and the live read-only scoreboard were
  both exercised against running gh/git, not asserted from source.

## Live PLOS scoreboard (criterion 8 — read-only, NO `--apply-safe`)
```
repo            : RUMAH-OS/property-lead-os
PRs             : active 7  (target 3, soft-limit 5)  *** BREACH (G8) ***
merge-ready     : 0      superseded : 0      stale : 1 (G6, PR #5, 16d)
consolidation   : 2 groups (G4) — path:.github [#193,#192,#191] · path:docs [#181,#175,#174]
branches        : 9 total · 3 merged-undeleted (G1) · 0 cherry-merged   [see Limit L1]
main            : deployable
applied         : []        <-- NOTHING MUTATED (no --apply-safe)
```
PR breach is REAL (7 open > soft-limit 5). The scoreboard is genuine and the run mutated nothing.

## Classified open assumptions

| Claim | Status | Severity |
|-------|--------|----------|
| `--self-test` passes, exit 0 | Confirmed (#1) | — |
| templates/ and .claude/ copies byte-identical | Confirmed (#2b, sha256) | — |
| Zero-dep, no `shell:true`, gh/git via execFileSync | Confirmed (#3, read both modules) | — |
| No rule action `"merge"`; merge is human-only via imported decideMerge | Confirmed (#1, #3 — Proof A) | Blocker-class, PASS |
| Squash-merge: MERGED-PR branch absent from `git --merged` → G1-SAFE high | Confirmed (#1, #3 — Proof B) | Blocker-class, PASS |
| `--apply-safe` mutates only guarded G1/G2; rest execute nothing | Evidence-backed (#3 — Proof C, code-read) | Should-fix verify live separately |
| Fail-closed when gh missing/unauthed, applied=[] | Confirmed (#7, live stub) | — |
| Live `--repo` run is read-only, real scoreboard, no mutation | Confirmed (#8) | — |
| Branch-side facts of a `--repo` run come from cwd git, not the remote (L1) | Confirmed (#8 vs L1) | Safe-to-defer (scope note) |

## Gate ledger

| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check` + self-test) | ✅ | #2a, #1 |
| Dedicated commit + slice id | ⬜ | uncommitted on `feat/repo-governance-capability` (per instruction: do NOT commit) |
| CI green — machine-read at merge | ⬜ | n/a — tool not merged; this VERIFY is pre-merge QA |
| Mutation reversible / guarded | ✅ (logic) / ⬜ (live) | Proof C; live `--apply-safe` exercised separately |
| Failure paths → honest error, no false success | ✅ | #7 fail-closed; applier try/catch falls back to propose |

## Honest limits
- **L1 — branch facts are cwd-scoped, not `--repo`-scoped.** `gh` calls honor `--repo`, but the `git branch -r` /
  `git cherry` calls run against the LOCAL cwd's clone. The PLOS run above reports the delivery-os clone's 9
  branches (3 merged), NOT PLOS's ~180+ remote branches. To audit PLOS's branch hygiene the tool must be run with
  cwd = a PLOS checkout. This is a scoping characteristic, not an unsafe path — and the PR-side scoreboard (the
  breach) is fully real. The brief's "~180+ merged-undeleted" expectation was therefore NOT reproduced from the
  delivery-os cwd; it would require running inside a PLOS clone. Recommend documenting this in the tool's `--help`.
- **L2 — live `--apply-safe` cleanup NOT exercised.** Per instruction, no mutation was performed. The applier
  GUARDS and routing are verified by code-read + self-test; the live deletion/close path is to be verified
  separately under controlled conditions.

## FAIL history
- none.

## Bug reports
1. [Safe-to-defer] `--repo` audits the remote's PRs but the LOCAL cwd's branches (L1). Not a correctness/safety
   defect; surface in `--help` so a user does not read the branch numbers as the remote's. → back to author.
