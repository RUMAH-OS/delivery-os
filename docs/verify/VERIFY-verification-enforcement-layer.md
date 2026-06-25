---
slice: "verification-enforcement-layer — binding gate → CI; local hook demoted to advisory (board 2026-06-25, D9/ADR-002)"
verify_status: verified
author: "enforcement-layer-agents"
verifier: "independent-qa"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/verify-coverage-ci.mjs --self-test"
impl_fingerprint: {"templates/hooks/verify-gate.mjs":"721a7a68164597502750189418facbf2af9421156118cd2ef26a2c350e96d197","templates/tools/setup-branch-protection.mjs":"dd943add69369d4f11cf9d8f2b6b80ead0127db32f5ac649ebf3114c4678f06a","templates/tools/verify-coverage-ci.mjs":"cb79b057a620cb58cffcd0734b24b64e06f6a159be2777914e464c8c0b18bc72","templates/tools/verify-independence-ci.mjs":"94ebaacea03364026146f2a30d213f160ddfc7b43432fb926f2d60a776a8dd7c"}
---

# VERIFY — Slice verification-enforcement-layer

## Verdict
**verify_status:** `verified`  ·  the CI `verify-coverage` gate is fail-closed, the local hook demotion preserves the binding gate (server-side), and the C6 founder-approved human-merge gate is intact and untouched.

> Independent verification (author≠verifier). The verifier did NOT author this slice. All evidence below is
> direct runtime output captured on this machine; the binding-gate self-tests are deterministic (no git, no network).

## Independence header  (Governance §3/§12)
- Verifier identity / invocation: `independent-qa` — distinct QA invocation, 2026-06-25, separate from the enforcement-layer build session.
- Author identity (code under test): `enforcement-layer-agents`.
- [x] I assert: the verifier did **not** author the production code under test (the four impl files below).
- [x] Independence was **real** — a separate verification pass, not the build context restyled.

## Execution evidence  (verbatim runtime output)
| # | Command | Exit | Output (verbatim / summary) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/verify-coverage-ci.mjs --self-test` | 0 | `6/6 checks passed.` · `SELF-TEST OK — semantic coverage gate is fail-closed (verified-only, fingerprint-matched, probe-surfaced).` |
| 2 | `node templates/tools/verify-independence-ci.mjs --self-test` | 0 | `7/7 checks passed.` · `SELF-TEST OK — author≠verifier is proven from git identity, fail-closed on a shared/empty identity.` |
| 3 | `node templates/tools/setup-branch-protection.mjs --self-test` | 0 | `10/10 checks passed.` · payload makes `verify-coverage` required + `require_code_owner_reviews` enforced. |
| 4 | `node --check templates/hooks/verify-gate.mjs` | 0 | `NODE-CHECK CLEAN` |
| 5 | `python -c "yaml.safe_load(verify-coverage.yml)"` | 0 | `YAML OK; on keys: ['pull_request']` · `branches: ['dev','main']` · `jobs: ['verify-coverage']` |
| 6 | `node templates/tools/verify-fingerprint.mjs compute --files <4 impl files>` | 0 | recorded the 4-file `impl_fingerprint` (frontmatter above) |
| 7 | `git status --porcelain templates/workflows/promote-to-prod.yml` | 0 | (empty) — C6 file unmodified by this slice |

## Acceptance criteria  (each PASS/FAIL + evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | CI coverage tool self-test PASS 6/6 and FAILS CLOSED (changed impl with no covering verified VERIFY → exit 1; reuses `verifyCoversImpl` semantic; non-`verified` status not counted; missing `impl_fingerprint` not counted; error → uncovered) | running the tool + reading the source | #1; source lines 112/114/119/133/164-168/180-182 | PASS |
| 2 | Independence tool self-test PASS 7/7; author≠verifier derived from GIT COMMITTER IDENTITY (`%ae`, impl-commit vs VERIFY-commit sets disjoint); fail-closed on single/shared/empty identity; not satisfiable by frontmatter strings | running the tool + reading the source | #2; source lines 43-65/74-88 | PASS |
| 3 | Workflow valid YAML; `on: pull_request [dev,main]`; runs coverage + independence + machine_probe steps; structured as a REQUIRED status check (gates merge via branch protection, not push); `fetch-depth: 0` | parsing + reading the workflow | #5; yml lines 39-42, 60-62, 99-138, 20-30 | PASS |
| 4 | Demoted local hook `node --check` clean; pre-commit + stop never block (exit 0, warn only); stop writes the auto-verify advisory marker; pre-push fail-closed ONLY for protected refs (dev/main/tags), warn-only for feature branches; SEMANTIC detection (verifyCoversImpl + impl_fingerprint + mtime fallback + inline-`#` parser fix) UNCHANGED; prominent SAFETY comment present | running `--check` + reading the source | #4; hook lines 2-9, 130-136, 159-205, 338-360, 363-462 | PASS |
| 5 | `setup-branch-protection.mjs` default DRY; payload `required_status_checks.contexts ["verify-coverage"]`, `require_code_owner_reviews:true`, `enforce_admins:true` | running self-test + reading the source | #3; source lines 38-51, 104-105 | PASS |
| 6 | Docs (`DECISIONS.md` D9 + `docs/adr/ADR-002` + GOVERNANCE §12/§13) state the new architecture and explicitly KEEP the C6 human-merge gate + the same author≠verifier invariant (now platform-enforced); migration documented safety-sequenced (CI gate first, then demote local) | reading the docs | DECISIONS D9 (line 16); ADR-002 ("What is UNCHANGED", "Migration sequence"); GOVERNANCE §12 (lines 70-72,78) / §13 (lines 83-85) | PASS |

## Surface statement
- Real surface: the four impl tools/hook executed directly (Node), the workflow parsed as YAML, the docs read on disk, and the C6 file's git status. No criterion was verified via a bypassing surface — every tool was RUN, not merely read; reads only corroborate the runtime behavior.
- [x] No criterion was "verified" via a surface that bypasses the slice.

## Load-bearing verdicts

### (A) The CI gate is FAIL-CLOSED — CONFIRMED
The required `verify-coverage` CI check is fail-closed at every step:
- **Coverage** (`verify-coverage-ci.mjs`): only `verify_status: verified` VERIFYs count (source line 114); coverage is SEMANTIC — it reuses the canonical `verifyCoversImpl` (lines 112/119), not mtime; a behaviorally-changed impl file is uncovered → `ok:false` → exit 1 (self-test #2, source 133/171/182); a `verified` VERIFY missing `impl_fingerprint` does NOT cover (self-test #4); any error proving coverage → `ok:false`, exit 1 (lines 164-168). Self-test 6/6.
- **Independence** (`verify-independence-ci.mjs`): author≠verifier is derived from GIT COMMITTER IDENTITY (`git log --format=%ae`, lines 82-86) — impl committers vs VERIFY committers must be DISJOINT; a single/shared identity, an empty verifier set, or any error → FAIL (lines 47-65, 102-106). It cannot be satisfied by frontmatter strings. Self-test 7/7, case-insensitive.
- **Probe re-run** (workflow step c): the covering VERIFY's `machine_probe` is re-run verbatim on the clean runner; zero probes or a non-zero exit → fail (yml 122-138).
- **Binding**: the workflow fires on `pull_request: [dev,main]` and is made a REQUIRED status check by branch protection (`setup-branch-protection.mjs` → `required_status_checks.contexts:["verify-coverage"]`, `strict:true`, `enforce_admins:true`, `require_code_owner_reviews:true`). It gates the MERGE, not the push, with `fetch-depth:0` for an accurate merge-base diff.

### (B) The local demotion is SAFE — the binding gate is preserved server-side — CONFIRMED
The hook (`verify-gate.mjs`) carries the prominent SAFETY comment (lines 2-9) stating it is advisory-only and that the binding gate is the CI `verify-coverage` required check + branch protection, which MUST be in place. pre-commit (338-349) and stop (351-361) never block (exit 0, `note()`/warn only); stop writes the `.verify-advisory.json` auto-verify marker (247-261). pre-push is fail-closed ONLY for protected refs (dev/main/release/tags — `PROTECTED_REF`, lines 374, 397-402) and warn-only for feature branches; an unparseable ref is treated as protected (conservative, line 394). The SEMANTIC detection logic is UNCHANGED — `verifyCoversImpl` + `impl_fingerprint` with the mtime staleness fallback (159-205) and the inline-`#` unquoted-scalar parser fix (130-136) are intact; only the enforcement posture changed from block→warn. The demotion lowers the LOCAL (reversible-commit) floor only; the binding (irreversible-merge) floor exists server-side first — the documented, safety-sequenced order (ADR-002 migration §: CI gate FIRST, then demote).

### (C) The C6 human-merge gate is PRESERVED — CONFIRMED
The C6 founder-approved gate lives in `templates/workflows/promote-to-prod.yml`, which is UNTOUCHED by this slice (evidence #7: clean git status; last commit is the prior SDLC commit `85547e6`, not this slice). It still fires on `pull_request_target: [labeled]`, does nothing unless the label is exactly `founder-approved` (GATE 1, `if:` line 56) applied by a verified CODEOWNER (GATE 2), then re-asserts the full merge floor (dev CI green + VERIFY verified) — fail-closed, no machine override, explicitly forbidding lights-out auto-merge. The new verification layer is ORTHOGONAL and additive (verify-coverage.yml lines 28-30; ADR-002 "What is UNCHANGED"; DECISIONS D9 "C6 human-merge gate unchanged"; GOVERNANCE §13 line 83). It strengthens the verification floor; it does not weaken or remove C6.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| The three self-tests (6/6, 7/7, 10/10) and `node --check` ran green on this machine | Confirmed (evidence #1-#4) | Blocker-class — met |
| Coverage/independence are fail-closed (verified-only, semantic fingerprint, git-identity disjointness) | Confirmed (self-tests + source read) | Blocker-class — met |
| C6 (`promote-to-prod.yml`) is unmodified by this slice | Confirmed (evidence #7) | Blocker-class — met |
| Branch protection actually being APPLIED on the live repos (`--apply` run by an admin) is operational, not in-tree | Assumption (out of slice scope — the tool defaults to DRY by design; ADR-002 migration step 1 is the operator action) | Safe-to-defer |
| The CI check's end-to-end behavior on a real GitHub PR runner | Unverified here (no live PR exercised); the deterministic self-tests + readable steps are the in-tree proof; the probe re-run is structurally present | Safe-to-defer |

> The two deferred items are operational provisioning, not code defects. The slice's tools are themselves
> the mechanism that, once `setup-branch-protection.mjs --apply` is run per repo, makes the gate binding —
> consistent with the documented safety-sequenced migration (CI gate first, then demote local).

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (all self-tests + node --check) | ✅ | #1-#4 |
| Workflow valid YAML, required-check shape, fetch-depth:0 | ✅ | #5, yml 39-62 |
| Semantic coverage fail-closed (verified-only + fingerprint + error→uncovered) | ✅ | #1, source 114/119/133/164-168 |
| author≠verifier from git identity, fail-closed on shared/empty | ✅ | #2, source 43-88 |
| Local hook advisory-only; pre-push fail-closed for protected refs only | ✅ | #4, hook 338-462 |
| C6 founder-approved human-merge gate intact + untouched | ✅ | #7, promote-to-prod.yml 33-94 |
| Docs (D9 · ADR-002 · §12/§13) state new arch, keep C6 + author≠verifier, safety-sequenced | ✅ | DECISIONS line 16, ADR-002, GOVERNANCE 70-85 |
| Failure paths → honest error, no false success (fail-closed throughout) | ✅ | self-test cases 2/3/4 (coverage), 2/3/4/6 (independence) |

## FAIL history
- none.

## Bug reports
1. None. No defect found. (Operational note, not a defect: branch protection must still be applied per repo via `setup-branch-protection.mjs --apply` by an admin — ADR-002 migration step 1 — for the in-tree gate to be binding on a given repo. This is the documented, intended operator action, not a fault in the slice.)
