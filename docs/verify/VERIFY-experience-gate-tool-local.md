---
slice: "experience-gate (v6 Track B floor)"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "cd c:/Users/brian/RUMAH/rumah-admin && npx vitest run tests/experience-gate-unit.test.ts"
test_pins_amended_by: "qa-test subagent (independent, 2026-06-14)"
---

# VERIFY — experience-gate (v6 Track B floor)

## Verdict
**verify_status:** `verified`  ·  All 7 acceptance criteria PASS on the validator's own surface (imported pure functions, run via vitest). The two load-bearing cases hold: a slow-but-correct surface (56000ms) is BROKEN, and a state-mismatch that "technically works" is BROKEN.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · independent verification invocation · 2026-06-14 21:57.
- Author identity (code under test): claude-opus main build session 2026-06-14 (authored experience-gate.mjs).
- [x] I assert: the verifier did **not** author the production code under test (experience-gate.mjs was read-only here; the verifier authored only the test).
- [x] Independence was **real** — a distinct invocation; the test was written fresh against the documented contract, not the build session's own assertions.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim / log path) |
|---|---------|------|------------------------------|
| 1 | `npx vitest run tests/experience-gate-unit.test.ts` (from rumah-admin) | 0 | `Test Files 1 passed (1)` · `Tests 9 passed (9)` |
| 2 | `node -e judgeExperience([mailbox 56000ms])` | 0 | broken / ok:false / "TOO SLOW — 56000ms > 4000ms budget (founder-facing)…" (see below) |
| 3 | `node -e judgeExperience([ask stateConsistent:false])` | 0 | broken / ok:false / "STATE MISMATCH — UI state does not match backend reality…" (see below) |

No shared store/queue/port touched — pure-function validator, no machine-guard needed.

### Cmd #2 — THE 60s-MAILBOX CASE (verbatim)
```json
{ "ok": false, "verdicts": [ { "surface": "mailbox", "verdict": "broken", "latencyMs": 56000, "budgetMs": 4000,
  "reasons": [ "TOO SLOW — 56000ms > 4000ms budget (founder-facing); a founder will not wait this every day (the 60s-mailbox lesson)" ] } ],
  "violations": [ "mailbox: TOO SLOW — 56000ms > 4000ms budget (founder-facing); a founder will not wait this every day (the 60s-mailbox lesson)" ],
  "degraded": [] }
```

### Cmd #3 — STATE-MISMATCH ("technically works" still fails) (verbatim)
```json
{ "ok": false, "verdicts": [ { "surface": "ask", "verdict": "broken", "latencyMs": 200, "budgetMs": 4000,
  "reasons": [ "STATE MISMATCH — UI state does not match backend reality (ASK-offline-but-input-enabled class)" ] } ],
  "violations": [ "ask: STATE MISMATCH — UI state does not match backend reality (ASK-offline-but-input-enabled class)" ],
  "degraded": [] }
```

## Acceptance criteria  (verbatim from the slice — each PASS/FAIL + evidence)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Healthy surface (available/consistent/complete, 900ms) ⇒ "good", ok:true | imports gate src, vitest | #1 | PASS |
| 2 | 60s-mailbox (56000ms, all correct) ⇒ "broken", ok:false, violation mentions TOO SLOW + budget | imports gate src + #2 | #1, #2 | PASS |
| 3 | Unavailable (available:false) ⇒ broken/ok:false (Room-offline class) | imports gate src | #1 | PASS |
| 4 | State mismatch, else fine+fast ⇒ broken/ok:false (technically-works still fails) | imports gate src + #3 | #1, #3 | PASS |
| 5 | Sluggish (2500ms, all true) ⇒ "degraded", ok:true, in `degraded` | imports gate src | #1 | PASS |
| 6 | `available` omitted/non-boolean ⇒ judgeExperience flags it | imports gate src | #1 | PASS |
| 7 | Determinism: same input → same output | imports gate src | #1 | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: the pure validator functions `judgeSurface` / `judgeExperience` exported by experience-gate.mjs. Driven by: direct ESM import via relative path in a vitest unit test (no DB/app — none required for a pure validator).
- [x] No criterion was "verified" via a surface that bypasses the slice. Every assertion runs the actual exported functions.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| judgeSurface applies the founder-facing budget (4000 acceptable) by default | Confirmed (#2 shows budgetMs:4000 with no tier) | — |
| Slow-but-correct ⇒ broken (the lesson) | Confirmed (#1, #2) | Blocker if false — held |
| State-mismatch ⇒ broken even when fast/available/complete | Confirmed (#1, #3) | Blocker if false — held |
| Unmeasured `available` is flagged regardless of verdict | Confirmed (#1, criteria 6a/6b) | — |
| Determinism | Confirmed (#1, JSON.stringify equality) | — |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1 (9/9 pass) |
| Dedicated commit + slice id | ⬜ | per instruction: do NOT commit; test left in tree, VERIFY doc written |
| CI green — machine-read at merge | ⬜ | n/a — no merge in scope |
| Migration reversible / fresh-DB | ✅ n/a | no DB — pure validator |
| Failure paths → honest error, no false success | ✅ | broken surfaces fail-closed (#2, #3); non-array & missing-surface guarded in src |
| RBAC/evals/canonical/money | ✅ n/a | not applicable to a pure experience validator |

## FAIL history
- none — first run green (9/9), both load-bearing cases confirmed.

## Bug reports
- none.

## Notes
- Test file (QA-owned, permanent): `c:\Users\brian\RUMAH\rumah-admin\tests\experience-gate-unit.test.ts` (9 tests encoding criteria 1–7; criterion 6 split into 6a omitted / 6b non-boolean).
- No temp artifacts created beyond the permanent test + this doc. Nothing committed.
