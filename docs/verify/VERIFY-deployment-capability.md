---
slice: "deployment-capability — state-authorized deployment (deploy by SDLC STATE, not founder per-deploy signature)"
verify_status: verified
author: "deployment-capability-agents"
verifier: "independent-adversarial-qa"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/deployment-auth.mjs --self-test"
---

# VERIFY — Slice deployment-capability (state-authorized deployment)

## Verdict
**verify_status:** `verified` · The load-bearing invariant holds under adversarial probing on the CURRENT file: `deployment-auth.mjs` never returns `authorized=true` while any REQUIRED governance step for the target env is unfinished/missing/unreadable/ambiguous; the `lane_scope` reconciliation (presence + action-declared + `freeze.frozen!==true` + no guard hit, NO `ratified` gate) is correct and fail-closed; the Class C / irreversible-BUSINESS-act human gate is UNCHANGED in code and docs. Re-issued so this artifact is newer than the impl.

## Independence header (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: `independent-adversarial-qa` · distinct adversarial QA invocation · 2026-06-25 · did NOT author this code.
- Author identity (code under test): `deployment-capability-agents`.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** — a second invocation that wrote and ran its OWN bypass probe (`/tmp/adv-probe.mjs`), independent of the author's `--self-test`.

## Execution evidence (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim / summary) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/deployment-auth.mjs --self-test` (re-run on the current file) | 0 | `deployment-auth --self-test PASS — fail-closed deployment authorization (computed from SDLC state)` … `(a) all-green prod -> authorized=true` … 12 fixture lines … `(d) any unreadable required input -> authorized=false (fail-closed, proven 6 ways)`; second PASS banner confirms the exact conjunction + monotonicity + inline-`#` strip. **EXIT 0.** |
| 2 | `node /tmp/adv-probe.mjs` (verifier's OWN probe, NOT the author's self-test) | 0 | 16 independent attempts to force `authorized=true` with a missing/false/unreadable REQUIRED signal → all 16 `REFUSED ok`; `all-green prod authorized=true`; `dev (hostile rest) authorized=true`; `dev verify-missing authorized=false`; **`BREACHES: 0`**. |
| 3 | byte-scan of `templates/tools/deployment-auth.mjs` (current) | 0 | `NUL bytes: 0`, `bad control bytes: 0`, size 45454 — clean text. |
| 4 | `grep` of `core/GOVERNANCE.md §6`, `capabilities/CANONICAL-SDLC.md`, `docs/adr/ADR-001-canonical-sdlc-v2.md`, `DECISIONS.md D7` | 0 | All four state the Class C / irreversible-business-act + merge-to-main human gate is UNCHANGED and "state-auth authorizes deploying the code, never performing the business act." |
| 5 | `grep` of `readLaneScope` in the current file | 0 | Lines 228-253: comment "the lane model has NO `ratified` gate"; `freeze.frozen===true → REFUSE`; not-valid-JSON → REFUSE; no declared actions → REFUSE; undeclared `--action` → REFUSE; guard hit → REFUSE. Freeze/presence-based, no ratification read. |

## Adversarial bypass attempt (the load-bearing claim)
**I tried to authorize=true with a missing required signal; result: could NOT.** Across 16 independently-constructed prod inputs — each knocking out exactly one required signal (verify absent / not-`verified`; ci absent / gh-down; merge not-ancestor / git-error; founder_review missing; class_c no-label / non-CODEOWNER applier; lane_scope absent / frozen / only-`_comment` / unparseable; classification null; action out-of-scope; action hitting a guard) — **every single one returned `authorized=false`** and named the correct first-unfinished step, and every result satisfied `validate()` (the contract's SAFETY-INVARIANT check). 0 breaches. The code basis: `evaluate()` sets a required signal's `passed` to `r.passed === true` (strict; line ~291), `authorized = firstUnfinished === null` over the required set (line ~297-298), the per-reader try/catch coerces a throw to `passed:false` (line ~287), every reader returns FAIL-CLOSED on error/ambiguity/unreadability, and the CLI wraps the whole evaluation in a top-level catch + a `validate()` self-check that downgrades any contract-violating result to `authorized:false`. No early-return-true, no default-true, no `||`-fallback, no catch-swallow grants a required signal.

## Acceptance criteria (each PASS/FAIL + evidence)
| # | Criterion | Surface | Evidence | PASS/FAIL |
|---|-----------|---------|----------|-----------|
| 1 | Self-test exits 0 / PASS (current file) | running tool | #1 | PASS |
| 2 | No bypass on any prod-required signal (verify, ci, merge, founder_review, class_c, lane_scope): missing/false/unreadable ⇒ authorized=false | running tool against fakeIO | #1, #2 | PASS |
| 3a | lane_scope: ABSENT or UNPARSEABLE lane ⇒ REFUSE | running tool | #2 (lane_scope absent / unparseable), #5 | PASS |
| 3b | lane_scope: `freeze.frozen===true` ⇒ REFUSE ("deploy frozen by founder") | running tool | #2 (lane_scope frozen) + #5 line 239-240 | PASS |
| 3c | lane_scope: with `--action`, undeclared action ⇒ REFUSE; guard-substring action ⇒ REFUSE | running tool | #2 (action out of scope / hits guard), #5 | PASS |
| 3d | lane_scope no longer requires `ratified` (present, non-frozen, action-declared ⇒ passes) | running tool | self-test `(+)` line `authorized=true (lane_scope=true)`; #5 (no `ratified` read) | PASS |
| 3e | Conjunction NOT weakened — prod still needs ALL of {verify, ci, merge, founder_review, class_c, lane_scope} | contract + running tool | `REQUIREMENTS.prod` (6 signals) + #2 all-green-only-authorizes | PASS |
| 4 | dev/preview authorize on verify+CI alone (even unmerged/unreviewed/Class-C-unapproved) but STILL refuse if verify or CI missing; dev≠prod; Class C still needs verify+CI at dev | running tool | #2 `dev (hostile rest) authorized=true`, `dev verify-missing authorized=false`; `REQUIREMENTS` monotonic | PASS |
| 5 | Wiring fail-closed in deploy-lane.mjs: REFUSE/error/missing-tool/non-zero-exit/unparseable ⇒ no deploy; `authorized` ANDed with `exit===0`; guard runs AFTER auth; audit records every path; `freeze.frozen` hard-stops | reading wrapper | code lines 81-103 (authorize fail-closed + `res.status===0 && verdict.authorized===true`), 145-148 (freeze hard-stop), 181-184 (enforce verdict), 190-194 (guard after auth), audit at 146/153/176/182/192/198/203 | PASS |
| 6 | Docs safety floor: Class C + irreversible-business-act (send/charge/publish/delete) + merge-to-main human gate UNCHANGED; "state-auth authorizes deploying the code, never performing the business act" explicit | reading docs | #4 (GOVERNANCE §6, CANONICAL-SDLC, ADR-001, DECISIONS D7) | PASS |
| 7 | File is clean text (no NUL/binary) | byte-scan | #3 | PASS |

## Surface statement (anti-Slice-1.0)
- Real surface: the `deployment-auth.mjs` state-checker (run via CLI `--self-test`) and its pure `evaluate()`/`validate()` composition (driven by the verifier's OWN fakeIO probe), plus the `deploy-lane.mjs` wrapper (the only deploy door) read for the wiring criteria, plus the four governance docs read for the safety floor.
- [x] No criterion was "verified" via a surface that bypasses the slice — the authorization logic was exercised by RUNNING it (tool exit codes + per-signal verdicts), not by reading code alone; doc-floor criteria are inherently document-surface.

## lane_scope verdict (the changed code)
PASS. The reconciled `readLaneScope` passes on lane PRESENCE + (with `--action`) the action being declared + `freeze.frozen !== true` + no guard-substring hit, with NO `ratified` gate — confirmed both that a present/non-frozen/declared lane now PASSES (no ratification needed) and that it remains FAIL-CLOSED: absent, unparseable, frozen, empty/`_comment`-only, out-of-scope action, and guard hit all REFUSE (#2, #5). The conjunction is intact: `REQUIREMENTS.prod` still lists `lane_scope` among all six required signals, so this reconciliation did not weaken prod authorization. Note (non-blocking observation, not a defect): the live `deploy-lane.mjs` `authorize()` does NOT forward `--action`, so the per-action guard/scope is enforced redundantly by the wrapper itself (action-declared check line 151-155; guard denylist line 190-194 AFTER auth) — defense-in-depth, still fail-closed.

## Wiring verdict
PASS. `deploy-lane.mjs` is fail-closed end-to-end: missing tool, `res.error`, unparseable stdout, or `exit !== 0` all yield `authorized:false`; `verdict.authorized = res.status === 0 && verdict.authorized === true` ANDs exit with flag; a non-authorized verdict audits + dies (no deploy); `freeze.frozen===true` hard-stops BEFORE auth is even consulted; the irreversible/destructive guard denylist runs AFTER auth on the rendered command; an unwritable audit log refuses rather than deploying silently; there is no override flag and no path to `spawnSync(cmd)` that bypasses the `verdict.authorized` enforcement.

## Class C / business-act human gate verdict
**UNCHANGED.** `core/GOVERNANCE.md` §6, `capabilities/CANONICAL-SDLC.md`, `docs/adr/ADR-001-canonical-sdlc-v2.md` (2026-06-25 refinement), and `DECISIONS.md` D7 all explicitly keep the Class C consequential decision + irreversible BUSINESS act (send money / charge / publish / send / delete) + merge-to-main human gate human-gated regardless of SDLC state, and each states verbatim that state-auth "authorizes *deploying the code*, never *performing the irreversible business act*." `founder_verifiable` is stated orthogonal to Class C. No code in `deployment-auth.mjs` or `deploy-lane.mjs` automates a business act; the wrapper's destructive guard denylist remains and runs after authorization.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Self-test exits 0 and exercises every required-signal-missing case (current file) | Confirmed (#1) | Blocker-if-false |
| No constructible input authorizes prod with a missing required signal | Evidence-backed (#2, 16 independent attempts, 0 breaches; `validate()` enforces) | Blocker-if-false |
| lane_scope reconciliation correct + fail-closed + conjunction intact | Confirmed (#2, #5 + REQUIREMENTS.prod) | Blocker-if-false |
| Wrapper fail-closed; guard after auth; freeze hard-stops; audit complete | Confirmed (code read 81-213) | Blocker-if-false |
| Business-act / Class C / merge-to-main human gate unchanged | Confirmed (#4, four docs) | Blocker-if-false |
| File is clean text | Confirmed (#3) | Should-fix-if-false |
| deployment-auth reads freeze only via `lane.freeze`; legacy `lane.ratified.frozen` is honored only by the wrapper (the deploy door), so a legacy-frozen lane still hard-stops at deploy | Confirmed (auth line ~239 vs wrapper line 56/145) — observation, not a hole | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (self-test, current file) | ✅ | #1 |
| Independent verification (author≠verifier) | ✅ | verifier's own probe #2 |
| Failure paths → honest error, no false success (fail-closed) | ✅ | #2 (16 refusals) + wrapper read |
| Security: irreversible/business-act human gate unchanged | ✅ | #4 |
| Clean text (no NUL/binary) | ✅ | #3 |
| Dedicated commit | ⬜ | not committed per instruction (verify-only) |

## FAIL history
- none.

## Bug reports
- none (no defects found). One non-blocking observation recorded above: `deployment-auth.mjs` `readLaneScope` checks `lane.freeze.frozen` but not the legacy `lane.ratified.frozen`; the deploy door (`deploy-lane.mjs`) honors both, so the FREEZE kill-switch still hard-stops every real deploy. Documentation already designates `freeze.frozen` as canonical. No action required for this slice.
