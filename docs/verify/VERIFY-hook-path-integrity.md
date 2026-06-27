---
artifact: VERIFY-hook-path-integrity
verify_status: verified
verdict: PASS
author: software-engineer-agent
verifier: qa-test
date: 2026-06-27
slice: hook-path-integrity fix (founder-action-package MODULE_NOT_FOUND class)
author_agent: implementing engineer agent (software-engineer role) — authored the UNCOMMITTED working-tree change
verifier_agent: qa-test (this report) — independent verification, author≠verifier (Governance §12)
authorship_separation: confirmed — verifier did NOT author, did NOT modify the implementation, did NOT commit; all gates re-run from scratch
impl_fingerprint: sha256(sorted per-file sha256 of the 9 implementation files) = ee6d4497ca92c1f112d17fc39d54c3ed9c5c274b55166694f180296415ad0fde
---

# Validation Report — hook-path-integrity (check-hook-paths.mjs)

## Verdict: PASS (verify_status: verified)

Every acceptance criterion met, proven by independently re-run gates on the working tree.
The fix closes the founder-action-package `MODULE_NOT_FOUND` incident class with a fail-closed,
self-testing regression gate, and the original failing command now runs clean.

## Implementation surface under test (impl_fingerprint inputs)

| File | sha256 |
|---|---|
| templates/tools/check-hook-paths.mjs (NEW, source of truth) | 4747aedf1fb01ebbaa77b91445dad0c5e61513da657f8104eb7878abda299459 |
| scripts/check-hook-paths.mjs (NEW, framework wrapper) | e2e051f64773ed9bc77b3b9e513265ca23236daf2ccfd51a921d8192c484af51 |
| skills/founder-action-package/SKILL.md | 95ae2ef4ce5ff30a91b190507f44828be344787504178ac307a71c9578c8daeb |
| .claude/skills/founder-action-package/SKILL.md (mirror — byte-identical) | 95ae2ef4ce5ff30a91b190507f44828be344787504178ac307a71c9578c8daeb |
| .githooks/pre-push (Gate 4) | f64d03813b33f8eeac8bae34b897dd0fedc3e75913497a8e52c135f34d8c2a53 |
| templates/githooks/pre-push (Gate 5) | f4978aa17a219c66189d4608aafaf1208aa35879f6a1eef5c469be3193de13db |
| scripts/new-project.sh | c9a4a8d4e997ed41439a666c5aaf38a6da6f6a314926be1808ab03ecb032f5f1 |
| capabilities/os-foundation.manifest.json | 9d2d8678db72fead27306d4f3116d21466ca2c376fa16ae6b11422ffdf769b3a |
| templates/workflows/hook-path-integrity.yml | d7f8efc633fa3fc8c1a3c6dd2b1556bfeccd3c2513d0d0313d51157810f626ff |

(LEARNING-REVIEW doc sha256: b89077300b7df14e28a5865588e2ee5c0c9f5aa729a52f74d1bb20ba5372a368 — documentation, not part of the executable fingerprint.)

## Criteria checked — evidence (exit codes captured verbatim)

### 1. Self-test fails the gate on the incident class — exit 0; self-test substance CONFIRMED real, not stubbed
```
node scripts/check-hook-paths.mjs --self-test
  self-test PASS: flags missing + broken + unresolvable-bare + skill-relative-nested; passes valid explicit/bare/co-located.
EXIT=0
```
Read of `templates/tools/check-hook-paths.mjs` selfTest() (lines 142-182) confirms it builds a real
temp tree and asserts the gate FAILS on each of the four incident sub-classes (each a `must(...)` that
throws if not flagged):
- **skill-relative nested path (the exact FAP class):** fixture `s-nested/SKILL.md` references
  `node .claude/skills/s-nested/templates/tools/good.mjs` — an explicit path that resolves only under
  the skill's own dir → asserted FAIL (line 166). This is the literal incident shape.
- **missing tool:** `templates/tools/missing.mjs` → asserted FAIL (line 163).
- **node --check failure:** `broken.mjs` containing `export const = ;` (real syntax error) → asserted FAIL (line 164).
- **unresolvable bare ref:** `nonexistent-bare.mjs` → asserted FAIL (line 165).
Plus positive controls: valid explicit / bare→tooldir / co-located refs asserted OK (lines 167-170),
and exact failure count asserted (`skillFailures.length === 4`, line 174) so a checker that flags
everything cannot pass. Runtime-spawn check also asserted to bite (line 175). Not stubbed.

### 2. Live scan — exit 0, 0 broken
```
node scripts/check-hook-paths.mjs
check-hook-paths: 34 reference(s) — 0 broken — PASSED
EXIT=0
```
All 34 references resolve + `node --check`-load, incl. founder-action-package's two spine tools as
`explicit-path` kind (`templates/tools/boundary-classify.mjs`, `templates/tools/goal-stop.mjs`).

### 3. Governance tool self-tests / load probes — all exit 0, NO MODULE_NOT_FOUND
```
node templates/tools/boundary-classify.mjs --self-test   EXIT=0  (PASS)
node templates/tools/goal-stop.mjs       --self-test      EXIT=0  (PASS)
node templates/tools/review-trigger.mjs  --self-test      EXIT=0  (PASS)
node templates/tools/learning-trigger.mjs --self-test     EXIT=0  (PASS)
node --check .claude/hooks/verify-gate.mjs                EXIT=0
```

### 4. Original failure reproduced-as-gone
```
node templates/tools/boundary-classify.mjs --self-test    EXIT=0  (PASS)
```
The command that previously `MODULE_NOT_FOUND`ed when its path was resolved against the skill dir now
runs from the delivery-os root. SKILL.md executable invocations (lines 72, 85, 107) carry explicit
`templates/tools/<x>.mjs` paths; the remaining bare mentions (e.g. lines 43, 63, 90 "boundary-classify")
are prose, NOT `node <basename>` commands — the live scan's extractor classifies this skill's refs as
`explicit-path` only, confirming no executable bare-basename ambiguity remains. The two SKILL.md mirrors
(skills/ + .claude/skills/) are byte-identical (same sha256) — the mirror is in sync.

### 5. validate-skills exit 1 is PRE-EXISTING + unrelated — CONFIRMED
```
node scripts/validate-skills.mjs   EXIT=1   (26 skills — 4 errors)
  FAIL ci-release-orchestrator  (Missing ## Process)
  FAIL parity-oracle            (Missing ## Process, ## Verification)
  FAIL repo-governance          (Missing ## Process)
  ok   founder-action-package
```
The 3 failing skills are NOT in this change's modified set (git porcelain shows only
`founder-action-package/SKILL.md` among skills is touched). `founder-action-package` itself validates
`ok`. The exit 1 is a pre-existing frontmatter-format gap in three unrelated skills, independent of this fix.

## Wiring verification
- `.githooks/pre-push` **Gate 4** runs `node scripts/check-hook-paths.mjs` (fail-closed) — tool present.
- `templates/githooks/pre-push` **Gate 5** runs `node .claude/tools/check-hook-paths.mjs` (consumer-install
  path), soft-guarded by `[ -f ... ]` — correct for a consumer template (copied by the scaffolder).
- `scripts/new-project.sh` copies the tool to `.claude/tools/` (line 150), `node --check`s it (line 179),
  and runs the live scan fail-closed at scaffold time (line 189).
- `capabilities/os-foundation.manifest.json` registers `templates/workflows/hook-path-integrity.yml`.
- `templates/workflows/hook-path-integrity.yml` and the LEARNING-REVIEW doc exist.

## Caveats (non-blocking)
- C1. The framework repo does NOT yet contain `.claude/tools/check-hook-paths.mjs`; only `scripts/` +
  `templates/tools/` copies exist. The framework's own Gate 4 uses `scripts/check-hook-paths.mjs` (present),
  so the framework is protected. The `templates/githooks/pre-push` Gate 5 `.claude/tools/` reference is the
  CONSUMER layout, soft-guarded — consistent with the documented v3.8 self-install lag (CLAUDE.md §9). Not a
  defect for this slice; flagged for the eventual re-sync.
- C2. Pre-existing validate-skills exit 1 (3 unrelated skills) is outside this slice's scope — separately tracked.

## Bug reports
None against the change under test.

## Independence statement
Authored by the implementing engineer agent (uncommitted working tree). Verified by qa-test. The verifier
did not write, modify, or commit any implementation; every gate above was re-run independently of the
author's report. Change remains uncommitted per instruction.
