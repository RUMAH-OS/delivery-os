---
slice: v4.0-consolidation (the F2 consolidated ratification check)
author: software-engineer (agent)
verifier: qa-test (agent)
date: 2026-06-12
verify_status: verified
machine_probe: "node scripts/validate-skills.mjs && node scripts/check-no-backflow.mjs"
test_pins_amended_by: "n/a — no tests/ e2e/ evals/ changed on this branch"
---

# VERIFY — Delivery OS v4.0 consolidation (branch `v4.0-consolidation`, 9 commits off `f9a84da`)

**RE-VERIFIED 2026-06-12 → STILL REJECTED — see §10: the fix commits closed findings 2–5 but never
touched `scripts/new-project.sh`; the Major reproduces unchanged at HEAD.**

**ROUND 3 (2026-06-12, after `579bdf6`) → see §11: findings 1 and 6 are CLOSED — the guard is real and
Layout A passes twice — but the now-reachable acceptance surface exposed a NEW Major (finding 7): the
scaffolded drift-lint false-positives on the v4 router template and blocks every new project's first push.
REJECTED on finding 7.**

**ROUND 4 (2026-06-12, after `917adc7`) → see §12: finding 7 CLOSED — the anchored regex passes both
layouts' first push clean AND still catches a genuine §9 version mismatch under adversarial probing.
All findings 1–7 closed. FINAL VERDICT: PASS — VERIFIED.** (The FAIL verdict below is the round-1
record, kept per FAIL-history discipline; §12 supersedes it.)

**VERDICT: FAIL — REJECTED (1 Major).** Everything in the packet except one finding passed independent
verification with real execution evidence. The Major is a scaffolder crash in the **documented invocation
layout**, found by running the release acceptance test (#84 step 9) — the v4 day-1-inheritance promise does
not survive its own documented usage. The fix is small and localized; on a fix + re-verify the remainder of
this packet stands as verified below (no other section needs re-doing unless the fix touches it).

Authority: `property-lead-os/docs/reviews/consolidated-inheritance-recommendation.md` (#85, the manifest)
+ `cross-system-os-assessment.md` (#84). Sources read for diffing: rumah-admin `43fcd53` skill files
(read-only), PLOS reviews/VERIFY corpus (read-only). Independence: this verifier authored no commit on the
branch; all evidence below was produced by fresh execution in this session.

---

## 1. The translation ledger — 126/126 rows verified present

Walked `CHANGELOG-v4.md`'s ledger against #85 §A.3 row-by-row.

| Section | #85 rows | In ledger | Destination exists on branch | Deep content checks |
|---|---|---|---|---|
| KERNEL K1–K31 | 31 | 31 | 31/31 | K1–K5 verbatim in `templates/CLAUDE.md.template` + seed + scaffolder 4d; K6–K31 = 26 doctrine-seed entries (D-EVIDENCE…D-CREDS, +D-UNPROVEN for N1), **every cited case-study anchor resolves** in `case-studies/2026-06-incident-ledger.md` (28 anchors, 0 missing); K13/K16/K31 ¶s confirmed in GOVERNANCE §15 |
| BASE B1–B38 | 38 | 38 | 38/38 | B1–B3 in GOV §12 + hook code; B4 merge-pr (no-override confirmed in code) + DoD row 9; B6/B7/B18/B23 GOV §7; B10–B12 GOV §11; B13–B15 GOV §15/§14 + detector code; B16/B17/B38 loop; B19/B24 DoD; B25–B27 processes; B28/B14 release-readiness rows 16/20/21; B29 test-harness; B30–B37 skills README + validator + render-kernel Trigger column + agents README |
| TEMPLATE T1–T12 | 12 | 12 | 12/12 | T2 (reversal + founder-acts fields), T3 (`machine_probe`, `test_pins_amended_by`, FAIL-history section, CI-deferral row deleted with tombstone), T7 (fixtures/heartbeat/overridden/credentials), T8 (C3-scoped table with explicit no-incident-→-delete rule), T9 two-doc rule, T11 SessionStart probe wiring, T12 event enum gains `review-artifact | n-merges-backstop`. T10 faithfully **not** landed (DO-NOT list; `core/` unrenamed; principle-11 directory kept, alias recorded) |
| SKILL S1–S19 | 19 | 19 | 19/19 (18 live + grill-me archived) | S1/S3/S9 diffed at technique level vs both sources (see §2); S10 carries N5+N8, S12 carries N4+N6, S15 carries the 6-item foot-gun stack, S5 trigger re-based on the probe, S16/S17 catalog notes, S18 verify-gate 1.1.0 single-dialect, S19 in `skills/_archive/` with pointer |
| PROJECT M1–M14 | 14 | 14 (listed, deliberately unplaced) | n/a by design | exclusion faithful to #85 §A.3.5 ("stay in their repos; base ships nothing"); noun-free extracts confirmed in base; `check-no-backflow.mjs` green |
| ARCHIVE X1–X12 | 12 | 12 | 12/12 | X1 scaffold-removal + `docs/archive/{wiki-templates,framework-wiki}` + citation-survival case study; X2/X3 `skills/_archive/`; X4 DoD rows deleted; X5–X7 faithfully project-side per #85 §A.3.6; X8 the anchored incident ledger; X9 kept + indexed; X10 two-doc rule; X11 negative doctrine in skills/README; X12 anchors `#emergent-assets` + `#n15-founder-hybrid` exist |

**Total: 126/126 mapped, 0 missing rows, 0 unmapped ledger rows.** ≥35 rows verified deeply at content
level across all destination types; the remainder verified at file-existence + spot-grep level.
**Unplaced list faithful:** T10 (no rename — confirmed: no `KERNEL/` dir, DO-NOT list re-ratified),
M1–M14 (#85 says PROJECT), X5–X7 (#85 says project-side, X5 gated on PLOS P0-4), F4/F5 open (#85 §E says
both remain undischarged PLOS-side obligations — the ledger's "F4/F5 remain open" is exactly #85's text).

## 2. Union skills (the #84 risk-2 model-proving test) — COMPLETE, no silently dropped technique

**verification 2.0** diffed against rumah-admin `verification-playbook` (read in full) and PLOS's
qa-adversarial practice (per #85 S1's authoritative technique enumeration; PLOS has no skill file — its
practice lives in VERIFY artifacts):
- Admin side, all present with [A] tags: distinct verifier · verifier-authored fixtures/synthetic-only ·
  disposable postgres:16 + applies-clean double-duty · happy-path-on-real-surface · all 6 named adversarial
  mutations · refusals-before-side-effects · transactional row-count proof · allow+deny live probes + dev
  backdoors 404 · verbatim-evidence VERIFY + verified-vs-executed + verifier-never-fixes · FAIL-history
  kept-in-doc · stash-run-pop baseline · stale-PID check · "prose is not evidence".
- PLOS side, all present with [P] tags: **machine-guard preamble** (step 2) · **mutation-probe + sha256-identical
  restore** (step 5) · **run-unique tokens** (step 2) · **reversal-rehearsal R1/R2** (step 8) ·
  **render-level evidence** (step 4) · fix-surface mtime forensics + kept-repro rejection (step 9) ·
  assertTestDatabase `*_test` guard (step 2).
- Reference rows adapted with [R] tags (Prove-It, doubt-theater, ARTIFACT+CONTRACT-not-CLAIM).
- `earned_from` present and per-technique tagging used throughout. **Zero dropped techniques.**

**executable-contracts 2.0**: [P] contract-freeze (one-contract-per-seam in producer repo, "peer constraints
overridden" mandatory + rejected-on-form, credentials-at-spec-time, the dual-contract incident) ∪
[A] frozen-contracts-as-code (fixtures, consumer-CI heartbeat, never-re-implement / one-derivation K28) +
N7 production-over-localhost — all present, `earned_from` cites both sides. **Complete.**

**learning-review 2.0**: all 7 Admin steps + all 3 Admin red flags present; step 6 is replaced by the
**C1 blast-radius fork verbatim-in-substance** (6a project-local → same commit series; 6b OS-level →
OS-FEEDBACK, design-first, "never write the base… or a version label from a retro series") with the earning
incident named; + B16 bump-or-declare (step 7) + N1 unproven-until-fired red flag. `earned_from` honestly
names the source retro's own bypass. **F8 condition met.**

## 3. F-signatures — applied correctly

- **F1 PASS:** `VERSION` = `v4.0`; CHANGELOG-v4 records both named adoption moments (PLOS = learning-review
  gate fires; Admin = June invoicing run, doubling as the skills-first N1 test) + the anti-third-fork rule;
  Admin's `v4.0-skills-first` label explicitly superseded; GOVERNANCE §14 now carries "overlays never mint
  OS versions; consumers adopt by pin". Scaffolded consumers pin via `.verify-config.json os_version`
  (observed: `v3.8-9-gd85f563` pre-tag — correct `git describe` behavior; becomes `v4.0` at tag).
- **F3 PASS:** `templates/DECISIONS.md.template` is question-keyed, append-only, status-grammar'd
  (OPEN→RATIFIED→IMPLEMENTED→SUPERSEDED), and states "the ledger fronts BOTH body dialects (founder ruling
  F3): ADR or proposal+signature".
- **F6 PASS (one stale remnant — finding 2):** wiki removed from the scaffolder (explicit F6 comments,
  lines 25/98/191); templates archived at `docs/archive/wiki-templates/` + framework wiki at
  `docs/archive/framework-wiki/` (R100 moves, nothing deleted); `case-studies/2026-06-wiki-citation-survival.md`
  exists with the zero-pages/57-slices evidence; scaffolded throwaway has **no `wiki/`**.
- **F7 PASS (detector code read + verified):** `templates/hooks/verify-gate.mjs` pre-push mode — the
  review-artifact detector (docs/reviews/, `CHANGELOG-v*`, `VERSION`, RETROSPECTIVE/POSTMORTEM/… basenames;
  installed-copies/templates excluded) `process.exit(1)`s without a same-push `docs/feedback/OS-FEEDBACK-*.md`;
  the N-merges backstop (default 30, config-keyed) `process.exit(1)`s likewise. Both HARD-BLOCK, no
  warn-mode. `templates/githooks/pre-push` routes the push range through it (Gate 1) + drift-lint (Gate 2)
  + validate-skills (Gate 3).
- **F8 PASS:** learning-review 2.0 ships as the phase-end default with the fork (§2 above); multi-blind-lens
  reserved for OS-level/capstone in its NOT-cases.

## 4. Mechanisms — executed, with mutation evidence

| Check | Result |
|---|---|
| `node --check` on all 8 changed/new `.mjs` | all OK |
| `bash -n scripts/new-project.sh` + `templates/githooks/pre-push` | both OK |
| `node scripts/check-no-backflow.mjs` | exit 0 — "names no project" |
| `node scripts/validate-skills.mjs` | exit 0 — 18 skills, 0 errors (3 stock skills exempt by validator-resident exemption, per B37 design) |
| **Mutation probe** on validate-skills | planted malformed `skills/zz-mutation-probe/SKILL.md` → **7 errors, exit 1, FAILED (fail-closed)** incl. B32 description-discipline error → removed → exit 0, tree clean. Restore confirmed |
| `node .claude/tools/check-os-drift.mjs` (framework self) | exit 0; router matches the (still-v3) self-install — consistent with honest note 1 |
| os_version-from-pin lint (C2/B7) | code verified in `templates/tools/check-os-drift.mjs`: fails closed on stamp≠pin AND router-§9≠pin with the "overlays never mint OS versions" message |
| merge gate | `templates/tools/merge-pr.mjs`: "THIS GATE HAS NO OVERRIDE FLAG ON PURPOSE" — confirmed in code |

## 5. Release acceptance test (#84 step 9) — **FAIL in the documented layout** (the Major)

**Layout A — the DOCUMENTED invocation** (per the script header "Run from the ROOT of your new project,
after adding delivery-os as a submodule or copy", usage `bash delivery-os/scripts/new-project.sh …` —
identical in `GETTING-STARTED.md:22,44,159` and `README.md:54`): fresh clone of the branch at
`./delivery-os` inside a temp project root →
```
cp: cannot copy a directory, '/tmp/v4acc-o8jf/delivery-os/core', into itself, 'delivery-os/core/core'
TRUE-EXIT=1
```
`scripts/new-project.sh:128` (`cp -r "$DOS/core" delivery-os/core`) self-copies when `$DOS` resolves to
`<cwd>/delivery-os`; `set -euo pipefail` aborts mid-scaffold. Consequences observed: **half-scaffold left on
disk** (steps 6/6a/6b/6c never run — no hooks, no settings.json, no verify-config, no os-sync, and the
author's own 6c "a half-scaffold is not a project" integrity check is unreachable), **and the vendored
delivery-os copy is polluted** (`delivery-os/core/core` created before the abort). Reproduced twice on
clean clones.

**Layout B — scaffolder invoked from a sibling checkout** (`bash ../dos-src/scripts/new-project.sh`):
**PASS in full.** Inventory verified on the scaffolded throwaway: verify-gate + sibling-probe hooks,
`.claude/settings.json`, committed `.githooks/pre-push` with `core.hooksPath=.githooks`, `scripts/merge-pr.mjs`,
all four tools (os-sync/check-os-drift/render-kernel/validate-skills), **core skill pack lint-green (15
skills, 0 errors)**, four registries (`docs/{DECISIONS,INVARIANTS,gates,friction-log}.md`), doctrine seed at
`memory/doctrine/doctrine-seed.md`, friction-log stub, manifest schema, test-DB guard, `.gitattributes` +
`.env.example`, vendored `delivery-os/core/GOVERNANCE.md`, branches main+dev, os_version pin recorded,
**no wiki**. **PATH-stripped smoke re-run independently: `env -i PATH=/nonexistent /bin/sh .githooks/pre-push`
fails CLOSED (nonzero, push blocked)** — the scaffolder's claim holds.

## 6. C-rulings

- **C2 PASS** — "hand-maintained" line deleted from `templates/CLAUDE.md.template` (tombstone note records
  why); pin-derived os_version lint verified in code (§4). Root `CLAUDE.md` no longer carries the line.
- **C3 PASS** — spot-checked 6 skills: rationalization tables present ONLY in `verification` (S37/PR-merge-on-red
  incidents cited per row) and `debugging-and-error-recovery` (vendored exemplar); absent in friction-triage,
  gate-ledger, instruments-audit, decision-ratification, cutover-execution. `templates/SKILL.md.template`
  carries the explicit "no incident → DELETE this section" rule.
- **C6 PASS** — `skills/verify-gate/SKILL.md` 1.1.0 now carries the full single dialect (stability,
  decision_class, inputs/outputs, earned_from, mechanical_spine); validate-skills keeps it that way (Gate 3).

## 7. Honest-notes audit

- **Note 1 (self-install lag) HONEST + RATIFICATION-MECHANICAL:** live `.claude/skills/` still the 7-skill
  v3 set; root router §9 says so explicitly ("skills installed: 7 (self-install; v4 catalog = 18)"); the
  branch templates are canonical and complete, so the post-ratification sync is a mechanical copy + os-sync +
  render-kernel. Drift-lint green against the honest current state.
- **Note 3 (STATUS/project-log grandfathering) CONFIRMED:** templates remain on disk, no longer scaffolded
  (X4 comment at scaffolder 4b), DoD rows deleted, v4.1 deletion noted.
- **Note 4 honored:** the acceptance test was left to this verifier and was run (§5) — author≠verifier held.

## 8. Findings

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | **Major (release-blocking)** | Scaffolder crashes in the **documented invocation layout** (delivery-os vendored at `./delivery-os`): self-copy at `scripts/new-project.sh:128` → `set -e` abort → half-scaffold (hooks/tools/6c check never installed/run) + pollution of the vendored copy (`delivery-os/core/core`). Pre-existing since v3.8 (`f9a84da` line 87) — but this branch's headline commit reworked exactly this file ("a new project inherits the month's learning on day 1") and the release acceptance test gates on it. Fix: skip/guard the vendoring `cp` when `$DOS` already is `<cwd>/delivery-os` (and consider `|| exit`-messaging parity with the 6c FATALs). | `scripts/new-project.sh:127-129`; documented at `GETTING-STARTED.md:22,44,159`, `README.md:54`, script header |
| 2 | Minor | GOVERNANCE §14 routing still sends project-specific lessons to "project `wiki/{learnings,findings}` + ADR" — the wiki layer this same packet retires (F6/X1). Contradicts commit d85f563's "every shipped surface" claim. Should route to `memory/<project>/` + the DECISIONS ledger per B17. | `core/GOVERNANCE.md:96` |
| 3 | Minor | `skills/ecosystem-alignment-review/SKILL.md` frontmatter `version: 1.0.0` while its own changelog and the CHANGELOG-v4 ledger record 1.1.0 — a bump-or-declare (B16) violation on the packet's own surface. validate-skills does not cross-check frontmatter-vs-changelog (acceptable gap; note for v4.1). | `skills/ecosystem-alignment-review/SKILL.md:3` vs `:42` |
| 4 | Minor | `templates/OS-FEEDBACK.md.template` routing-table example destination still offers "`<wiki / ECR / framework change…>`" post-F6. | `templates/OS-FEEDBACK.md.template:20` |
| 5 | Minor | `README.md` headline still says "Current baseline: v3.6 (this README current as of v3.7)" on the v4.0 cut — the branch edited README §3/§5 but left the version line stale; at tag time the repo front page contradicts `VERSION`. | `README.md:5` |

## 9. Per-section verdicts

| Section | Verdict |
|---|---|
| 1. Translation ledger (126 rows + exclusions) | **PASS** — 126/126, exclusions faithful |
| 2. Union skills (S1/S3/S9 technique-level) | **PASS** — zero dropped techniques; C1 fork present |
| 3. F-signatures (F1/F3/F6/F7/F8) | **PASS** (F6 with stale remnants → findings 2/4) |
| 4. Mechanisms (lints, mutation probe, syntax) | **PASS** — all executed green; mutation probe trips and restores |
| 5. Release acceptance test | **FAIL** — documented layout crashes (finding 1); alternate layout passes the full inventory + PATH-stripped smoke |
| 6. C-rulings (C2/C3/C6) | **PASS** |
| 7. Honest notes | **PASS** — gaps documented, not hidden; ratification-sync mechanical |

**Overall: FAIL → REJECTED on finding 1.** Re-verification scope after the fix: re-run the acceptance test
in BOTH layouts + `bash -n` + one clean-clone scaffold inventory; findings 2–5 may ride the same fix commit
(they are localized text corrections) — none requires re-opening sections 1–4/6–7.

---

## 10. RE-VERIFICATION — 2026-06-12 (after fix commits `4c42a4e` + `50f2d40`)

**Re-verifier: qa-test (agent). Fix author: claude-orchestrator.** Scope per §9's prescription:
acceptance test in both layouts + `bash -n` + clean-clone inventory + finding 2–5 closures + diff audit;
sections 1–4/6–7 stand (the diff confirms the fix touched none of their surfaces).

**RE-VERDICT: FAIL — REJECTED AGAIN. The Major (finding 1) was never fixed.**

### Diff audit (1182add..50f2d40)
Exactly 4 files changed, 4 insertions(+), 4 deletions(-): `README.md`, `core/GOVERNANCE.md`,
`skills/ecosystem-alignment-review/SKILL.md`, `templates/OS-FEEDBACK.md.template`. Nothing extraneous —
**but `scripts/new-project.sh` is NOT in the diff.** Commit `4c42a4e`'s message claims
"scaffolder self-copy guard (Major)"; its content contains no such change. `git log -1 -- scripts/new-project.sh`
= `142fd8a` (pre-rejection); line 128 still reads `cp -r "$DOS/core" delivery-os/core`, unguarded.

### Acceptance test — Layout A (documented invocation): **FAIL, reproduced twice at HEAD `50f2d40`**
Fresh clean clones in `/tmp/v4reA1-6Jmb` and `/tmp/v4reA2-o6af`, branch cloned to `./delivery-os`,
`bash delivery-os/scripts/new-project.sh "<name>" "crm"`:
```
cp: cannot copy a directory, '/tmp/v4reA1-6Jmb/delivery-os/core', into itself, 'delivery-os/core/core'
TRUE-EXIT=1
```
Identical on both runs. Consequences re-observed both runs: `delivery-os/core/core` pollution created,
half-scaffold left on disk (no `.githooks/pre-push`, no `.claude/hooks/verify-gate.mjs`, 6c integrity
check never reached). The crash is byte-for-byte the rejected behavior.

### Acceptance test — Layout B (sibling checkout): **PASS in full (no regression)**
Clean clone + empty project root (`/tmp/v4reB-*`): `TRUE-EXIT=0`. Inventory all present: verify-gate +
sibling-probe hooks, `.claude/settings.json`, `.githooks/pre-push` with `core.hooksPath=.githooks`,
`scripts/merge-pr.mjs`, all four tools, **core skill pack lint-green (15 skills, 0 errors, 0 warnings)**,
four registries (`docs/{DECISIONS,INVARIANTS,gates,friction-log}.md`), `memory/doctrine/doctrine-seed.md`,
friction-log stub, manifest schema, test-DB guard, vendored `delivery-os/core/GOVERNANCE.md`, branches
main+dev, **no `wiki/`**. PATH-stripped smoke: `env -i PATH=/nonexistent /bin/sh .githooks/pre-push`
→ "✗ push blocked by Delivery OS verify-gate", exit 1 — **fails CLOSED**.

### Findings 2–5 — all CLOSED (verified on disk at HEAD)
| # | Status | Evidence |
|---|---|---|
| 2 | **CLOSED** | `core/GOVERNANCE.md:96` now routes project-specific lessons to "project memory tiers (`memory/` per the three-tier model, v4/F6) + ADR" — wiki reference gone |
| 3 | **CLOSED** | `skills/ecosystem-alignment-review/SKILL.md:3` frontmatter `version: 1.1.0`, matching its changelog (line 42) and the CHANGELOG-v4 ledger (S5 row) |
| 4 | **CLOSED** | `templates/OS-FEEDBACK.md.template` routing example now "<project memory / ECR / framework change + case study + version bump>" — `grep wiki` empty |
| 5 | **CLOSED** | `README.md:5` now "**Current baseline: v4.0** (the consolidation release — see CHANGELOG-v4.md)" |

### Mechanisms re-run (framework repo, HEAD)
`check-no-backflow.mjs` exit 0 · `validate-skills.mjs` exit 0 (18 skills, 0 errors) ·
`.claude/tools/check-os-drift.mjs` exit 0 · `bash -n scripts/new-project.sh` OK ·
`bash -n templates/githooks/pre-push` OK.

### NEW finding
| # | Severity | Finding | Where |
|---|---|---|---|
| 6 | **Major (process)** | Fix commit `4c42a4e`'s message asserts "scaffolder self-copy guard (Major)" but the commit contains only the 3 doc-minor edits — the claimed fix for the release-blocking finding was never authored. A commit message claiming an unmade change is itself a defect (prose is not evidence; claim≠content). The next fix must actually change `scripts/new-project.sh` (guard the vendoring `cp` when `$DOS` = `<cwd>/delivery-os`) and the re-re-verification must re-run Layout A twice. | `4c42a4e` message vs `git show 4c42a4e --stat`; `scripts/new-project.sh:127-129` unchanged since `142fd8a` |

**Re-verification scope next round:** finding 1/6 only — Layout A ×2 + Layout B ×1 + `bash -n` + diff audit.
Findings 2–5 closures and sections 1–4/6–7 stand and need no re-opening unless the fix touches them.

## 11. RE-RE-VERIFICATION (round 3) — 2026-06-12 (after fix commit `579bdf6`)

**Re-verifier: qa-test (agent). Fix author: claude-orchestrator.** Scope per §10's prescription:
findings 1/6 only — diff audit + Layout A ×2 + Layout B ×1 + `bash -n` (+ the standing lints).
Independence: this verifier authored no commit on the branch; all evidence fresh-executed this session
on clean clones of `579bdf6` with run-unique project tokens.

### Diff audit (`d26873d..579bdf6`) — claim = content this time
Exactly 1 file changed: `scripts/new-project.sh` (+8/−3). The guard is REAL at lines 127–134:
`if [ "$(cd "$DOS" && pwd)" != "$(pwd)/delivery-os" ]; then … cp -r "$DOS/core" delivery-os/core … fi`
— the vendoring `cp` is skipped exactly when `$DOS` already *is* `<cwd>/delivery-os`. Consistent with
6c line 185 (`delivery-os/core/GOVERNANCE.md` resolves via the vendored clone itself in Layout A).
**Finding 6 (claim≠content) CLOSED.**

### Acceptance test — Layout A (documented invocation): **PASS, ×2 on clean temp dirs**
`/tmp/v4r3A1-4v708u-*` (packs `crm`) and `/tmp/v4r3A2-3mem5a-*` (packs `internal-admin`): branch cloned
to `./delivery-os`, `bash delivery-os/scripts/new-project.sh …` → **TRUE-EXIT=0 both runs**.
- **No pollution:** no `delivery-os/core/core`, no `delivery-os/discovery/discovery`; the vendored clone's
  `git status --porcelain` is empty (untouched) — both runs.
- **Hook chain installed:** `.githooks/pre-push` (+x), `.claude/hooks/{verify-gate,sibling-probe}.mjs`,
  `.claude/settings.json`, `core.hooksPath=.githooks` — both runs.
- **6c integrity check reached and green:** full 6c inventory present, `validate-skills: 15 skills — 0
  error(s) — PASSED`, final `✓ Scaffolded` banner printed — both runs. Branches main+dev; os_version pin
  `v3.8-14-g579bdf6` (correct `git describe` pre-tag); no `wiki/`.
- **PATH-stripped smoke (independent re-run):** `env -i PATH=/nonexistent /bin/sh .githooks/pre-push`
  → "✗ push blocked", exit 1 — **fails CLOSED**. **Finding 1 CLOSED.**

### Acceptance test — Layout B (sibling checkout): **PASS in full (no regression)**
`/tmp/v4r3B-af2kdg-*`: `bash ../dos-src/scripts/new-project.sh` → TRUE-EXIT=0. The guard correctly does
NOT skip here: doctrine vendored (`delivery-os/core/GOVERNANCE.md` + `delivery-os/discovery/` copied, no
`core/core`). Full 20-item inventory present (hooks, settings, merge-pr, all four tools, four registries,
doctrine seed, test-DB guard, manifest schema, `.gitattributes`/`.env.example`, verify-config pin,
VERIFY template), 15 skills lint-green, branches main+dev, no wiki. PATH-stripped smoke fails CLOSED.

### Mechanisms re-run (framework repo, HEAD `579bdf6`)
`bash -n scripts/new-project.sh` OK · `bash -n templates/githooks/pre-push` OK ·
`check-no-backflow.mjs` exit 0 · `validate-skills.mjs` exit 0 (18 skills, 0 errors) ·
`.claude/tools/check-os-drift.mjs` (framework self) exit 0.

### NEW finding — found on the acceptance surface the guard just made reachable
| # | Severity | Finding | Where |
|---|---|---|---|
| 7 | **Major (release-blocking)** | **Every freshly scaffolded v4 project's FIRST PUSH is blocked by a drift-lint false positive.** `templates/tools/check-os-drift.mjs:48` extracts the router's os_version with `/os_version\s*`([^`]+)`/` — the FIRST match in the scaffolded `CLAUDE.md` is the v4 template's own doctrine prose at line 9 ("…and \`os_version\` derives from the \`.claude/.verify-config.json\` pin…"), so `routerVer` = `" derives from the "` ≠ pin → fail-closed. Observed in all 3 scaffolds (masked at scaffold time by `new-project.sh:167`'s `\|\| echo "(drift warnings…expected)"`, but PERSISTENT: post-scaffold `check-os-drift.mjs` exits 1). Proven at render level: invoking the installed `.githooks/pre-push` with git's stdin protocol → Gate 1 (verify-gate) passes, **Gate 2 blocks**: "✗ push blocked by Delivery OS drift-lint". The message's remediation ("re-run render-kernel") CANNOT fix it — line 9 is the HAND half; §9 line 88 is already correct. Sole escapes: hand-edit the doctrine prose or `DELIVERY_OS_GATE_BYPASS=1` — a fail-closed gate that false-positives on day 1 trains bypass usage. Pre-existing (`374c218`/`d85f563`, before the rejections): unreachable in Layout A before this guard (scaffold crashed first) and unobserved in rounds 1–2's Layout B (swallowed at scaffold time; the throwaway's drift-lint was never re-run). The framework's own self-lint passes only because its still-v3 root router lacks the template's line-9 prose. Fix direction (verifier does not fix): anchor the extraction to the §9 derived line (e.g. match only on the `**Verification status (derived from disk…` line, or require a version-shaped capture), or reword template line 9 so `os_version` isn't followed by backticked prose. | `templates/tools/check-os-drift.mjs:48` (+ installed copies) vs `templates/CLAUDE.md.template:9`; mask at `scripts/new-project.sh:167` |

### Round-3 verdicts
| Item | Verdict |
|---|---|
| Diff audit (guard real, nothing extraneous) | **PASS** — finding 6 closed |
| Layout A ×2 (exit 0, no pollution, hook chain, 6c green) | **PASS** — finding 1 closed |
| Layout B ×1 (full inventory + fail-closed smoke) | **PASS** — no regression |
| `bash -n` + no-backflow + validate-skills + drift-lint (framework) | **PASS** |
| Release acceptance surface overall | **FAIL** — finding 7: scaffolded project's first push blocked by a false-positive gate |

**RE-RE-VERDICT: FAIL — REJECTED on NEW finding 7 (Major).** Findings 1–6 are all closed; the prescribed
round-3 scope passed in full — but the same acceptance surface finding 1 gated on (day-1 inheritance
surviving documented usage) now demonstrably ends in a blocked first push with misleading remediation.
`verify_status` stays `executed`; it does NOT flip to `verified`.

**Re-verification scope next round (finding 7 only):** fix, then (a) Layout A ×1 + Layout B ×1, each with
post-scaffold `node .claude/tools/check-os-drift.mjs` → exit 0 INSIDE the throwaway, (b) simulated
first-push hook invocation (`printf 'refs/heads/main <sha> …' | bash .githooks/pre-push origin <url>`)
→ exit 0 (or blocked ONLY by an honest gate, not a parse error), (c) framework self drift-lint still
exit 0, (d) diff audit. Sections 1–4/6–7 and findings 1–6 closures stand.

## 12. ROUND 4 — 2026-06-12 (after fix commit `917adc7`) — **PASS, VERIFIED**

**Re-verifier: qa-test (agent). Fix author: claude-orchestrator.** Scope per §11's prescription
(finding 7 only): diff audit + Layout A ×1 + Layout B ×1 with post-scaffold drift-lint + simulated
first-push hook invocation, framework self-lint + standing lints, plus an adversarial regex probe.
Independence: this verifier authored no commit on the branch; all evidence fresh-executed this session
on clean temp dirs with run-unique project tokens.

### Diff audit (`f1e53c5..917adc7`) — claim = content
Exactly 1 file changed: `templates/tools/check-os-drift.mjs` (+4/−1). The extraction is now anchored to a
version-shaped capture: `/os_version\s*`(v\d[^`]*)`/` (line 51), with a 3-line comment naming finding 7 as
the earning incident. Nothing extraneous.

### Layout A (documented invocation, `/tmp/v4r4A-r4a-1781273948-*`, pack `crm`) — **PASS**
- Scaffold TRUE-EXIT=0; no `delivery-os/core/core` pollution; vendored clone `git status --porcelain` empty.
- Scaffolded router carries BOTH lines: line 9 doctrine prose ("…`os_version` derives from the…") and
  §9 line 88 `os_version \`v3.8-16-g917adc7\`` = the `.verify-config.json` pin.
- Post-scaffold `node .claude/tools/check-os-drift.mjs` INSIDE the throwaway:
  `drift-lint: OK (15 skills checked, 0 warning(s))` — **exit 0** (was exit 1 at round 3).
- Simulated first push (git stdin protocol: `printf 'refs/heads/main <sha> refs/heads/main <40 zeros>' |
  bash .githooks/pre-push origin <url>`): Gate 1 verify-gate silent-pass, Gate 2 drift-lint OK, Gate 3
  `validate-skills: 15 skills — 0 error(s) — PASSED` → **PREPUSH-EXIT=0, no bypass needed**.

### Layout B (sibling checkout, `/tmp/v4r4B-r4b-1781273984-*`, pack `internal-admin`) — **PASS**
Scaffold TRUE-EXIT=0; doctrine vendored (`delivery-os/core/GOVERNANCE.md`, no `core/core`); post-scaffold
drift-lint **exit 0**; simulated first-push hook **exit 0**. No regression.

### Adversarial regex probe — the anchor did NOT blind the check
On a copy of the Layout A throwaway (prose line 9 intact throughout):
- **Probe 1** (§9 hand-edited to `v3.8`, pin untouched): drift-lint **exit 1** — "router §9 claims
  os_version `v3.8` but the .verify-config.json pin says v3.8-16-g917adc7".
- **Probe 2** (the §11 prescription: pin+stamp set to `v4.0`, router claims `v3.8`): drift-lint **exit 1**
  — "router §9 claims os_version `v3.8` but the .verify-config.json pin says v4.0" — the captured value is
  the genuine §9 version, not prose.
- **Probe 2b** (end-to-end): the installed `.githooks/pre-push` under the same mismatch → exit 1,
  "✗ push blocked by Delivery OS drift-lint" — the gate still fails closed on real drift.

### Framework repo (HEAD `917adc7`)
Self drift-lint exit 0 (7 skills) · `check-no-backflow.mjs` exit 0 · `validate-skills.mjs` exit 0
(18 skills, 0 errors) · `bash -n scripts/new-project.sh` OK · `bash -n templates/githooks/pre-push` OK.

### Round-4 verdicts
| Item | Verdict |
|---|---|
| Diff audit (anchored regex only, nothing extraneous) | **PASS** |
| Layout A ×1 (scaffold + in-throwaway drift-lint exit 0 + clean first push) | **PASS** |
| Layout B ×1 (same) | **PASS** |
| Adversarial probe (genuine mismatch still caught, ×2 + end-to-end hook block) | **PASS** |
| Framework self-lint + no-backflow + validate-skills + bash -n | **PASS** |

**v4.1 note (non-blocking, no finding):** the version-shaped anchor means a hand-edit of §9 to a
NON-version-shaped value (e.g. `os_version \`untagged\`` or `\`4.0\`` without the `v`) evades the
router-§9 redundancy check (the stamp≠pin check still holds, and render-kernel always writes the pin).
This residual is inside the fix direction §11 ratified ("require a version-shaped capture"); consider a
fallback FAIL when §9's derived line yields no version-shaped capture at all.

**ROUND-4 VERDICT: PASS.** Finding 7 CLOSED; findings 1–6 closures and sections 1–4/6–7 stand.
**`verify_status` flips to `verified`.** Next steps (outside this verifier's authority): Reviewer/Critic
conformance, founder merge/tag; at tag time the scaffolded pin becomes `v4.0` per F1 (§3).

## FAIL history
- 2026-06-12 — initial verification: REJECTED (this document, §1–§9). No prior runs.
- 2026-06-12 — re-verification after `4c42a4e`+`50f2d40`: **REJECTED AGAIN** — Major never fixed (fix
  commit message claimed a scaffolder guard its diff does not contain); findings 2–5 closed; Layout B
  still passes; new finding 6 (claim≠content in the fix commit).
- 2026-06-12 — round 3 after `579bdf6`: findings 1+6 **CLOSED** (guard real; Layout A passes ×2, Layout B
  ×1, all lints green) — **REJECTED on NEW finding 7 (Major)**: scaffolded drift-lint false-positives on
  the v4 router template prose and blocks every new project's first push (pre-existing, newly reachable).
- 2026-06-12 — round 4 after `917adc7`: finding 7 **CLOSED** (anchored regex: both layouts scaffold +
  first-push clean; adversarial probe proves genuine §9 mismatches still caught + hook still blocks) —
  **PASS, verify_status → verified.**
