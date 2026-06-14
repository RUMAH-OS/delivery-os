---
slice: "skill-router + frontmatter contract (v6 #6/#8)"
verify_status: verified
author: "claude-opus + software-engineer subagent (build session 2026-06-14)"
verifier: "qa-test subagent (independent invocation, 2026-06-14; re-verification after fix 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "cd ../rumah-admin && npx vitest run tests/skill-router.test.ts"
test_pins_amended_by: "qa-test subagent (independent invocation, 2026-06-14) — authored rumah-admin/tests/skill-router.test.ts; migrated v6-SKILLROUTER-01 case into ROUTE_CASES on re-verification"
---

# VERIFY — Slice skill-router + frontmatter contract (v6 #6/#8) — delivery-os tooling

Scope of THIS doc: the delivery-os tooling under test —
`templates/tools/skill-frontmatter.mjs` (parse/validate contract, #6) and
`templates/tools/skill-route.mjs` (deterministic ranker, #8). Proving ground: rumah-admin's
14 installed skills + the permanent test at `rumah-admin/tests/skill-router.test.ts`.

## Verdict
**verify_status:** `verified` (re-verification after fix, 2026-06-14) · Tooling defect v6-SKILLROUTER-01 is
RESOLVED in `templates/tools/skill-route.mjs`: `scoreSkill` now collects trigger/capability tokens into
per-skill sets so each distinct task-token contributes at most once per skill (no more uncapped `+3 ×N`).
On independent re-execution against rumah-admin's 14 real skills, all 15 route cases hit intent — the
formerly mis-ordered pair now resolves `production-readiness-review` (6.5) above `cutover-execution` (3.0),
margin 3.5 — while the legitimate cutover route (`"execute the production data cutover"`) is unharmed
(cutover-execution 22.5 vs production-readiness-review 6.5). Contract gate, determinism, tie-break, and
no-match all still PASS. The founder success criterion ("the system deterministically knows which skill to
invoke without recall") is now met for every natural phrasing tested → `verified`.

> Original verdict was `executed` (ranker mis-ordered 1/14). That record is preserved in the FAIL history
> and bug report below; this header reflects the post-fix re-verification.

## Independence header  (Governance §3/§12)
- Verifier identity / invocation: qa-test subagent · independent invocation · 2026-06-14 (NOT the build session)
- Author identity (code under test): claude-opus + software-engineer subagent (build session 2026-06-14)
- [x] I assert: the verifier did **not** author the tooling under test.
- [x] Independence was **real** — verifier wrote its own route corpus (different wording from `triggers`),
  its own malformed fixtures, and the permanent vitest file.

## Execution evidence  (Governance §1)
| # | Command | Exit | Output (verbatim, abridged) |
|---|---------|------|------------------------------|
| 1 | `node tmp-verify.mjs` (independent harness, since deleted) | 0 | 14 dirs ALL VALID:true; 5/5 malformed rejected + control ok; route table (see below); stable:true; tie aaa<zzz; no-match length 0 |
| 2 | `cd ../rumah-admin && npx vitest run tests/skill-router.test.ts` | 0 | `Test Files 1 passed (1)` · `Tests 42 passed (42)` |
| 3 | `cd ../rumah-admin && npm run skill:route -- "run the phase-end retrospective"` | 0 | top-1 `learning-review` 16.0 (trigger~ phrase + cap tokens) |

> Machine-guard line: pure functions + read-only file reads; no shared store/queue/port. No run-unique
> token needed. The route corpus reads the REAL on-disk skills, so the test self-detects any future
> trigger/frontmatter drift in the consuming project.

### Re-verification evidence (after fix, 2026-06-14)
| # | Command | Exit | Output (verbatim, abridged) |
|---|---------|------|------------------------------|
| R1 | `node route-verify.mjs` (independent harness, real `.claude/skills`, since deleted) | 0 | `skills loaded: 14`; `15 pass / 0 fail`; kubernetes/plants → `[]`; `determinism equal: true` |
| R2 | `node fm-verify.mjs` (independent contract harness, since deleted) | 0 | `count: 14`; 14× `OK`; control ok; 6 malformed shapes + null `rejected` |
| R3 | `cd ../rumah-admin && npx vitest run tests/skill-router.test.ts` | 0 | `Test Files 1 passed (1)` · `Tests 43 passed (43)` |

### Ranker behavior (criterion 2) — the load-bearing result, NOW PASSING
15/15 of the verifier's independent phrasings route to the intended skill with positive margins. The
formerly failing case is fixed:

`"are we cleared to promote this build to production"` →
top-1 `production-readiness-review` **6.5** vs `cutover-execution` **3.0** (margin **+3.5**).
Reason trace post-fix: cutover-execution's `production` token, repeated across 3 triggers + 1 capability,
is now deduped to a single `+3`; production-readiness-review keeps its genuine `promote/production`
phrase-token hit (6.5) and wins. The genuine intent now beats scattered repetition.

Regression check (charter-flagged neighbors — all still correct):
- verify-gate (15, "commit hook denied my turn") vs verification-playbook (18, "how to actually verify a slice") → both correct, margins 15 / 14.
- migration-assessment (9) / legacy-migration-etv (24.5) / cutover-execution (24) → each routes to its own intent with margin ≥8.
- `"execute the production data cutover"` → cutover-execution (22.5) over production-readiness-review (6.5): the dedup does NOT starve the legitimate cutover route.
- production-readiness-review now wins its own intent (was the ONE failing neighbor).

## Acceptance criteria
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | Contract valid for all 14 + rejects malformed (non-vacuous) | `validateSkillFrontmatter`/`readSkillFrontmatter` over real files + fixtures | #1,#2 | PASS |
| 2 | Deterministic routing — verifier cases hit intended; ambiguous neighbors clear margin | `routeTask`/`loadSkills` | R1,R3 | **PASS** (15/15 after fix; was FAIL pre-fix) |
| 3 | Determinism — stable; ties by name | repeated call deep-equal + synthetic tie | R1,R3 | PASS |
| 4 | No-match honesty — unrelated → empty | `routeTask("rebalance the kubernetes cluster")` → [] | R1,R3 | PASS |
| 5 | Permanent test passes, enforces routing in CI | `npx vitest run tests/skill-router.test.ts` | R3 | PASS (43 tests) |

## Surface statement
- Real surface: the exported tool functions invoked exactly as the router/gate invoke them, plus the
  shipped CLI (`node templates/tools/skill-route.mjs` via the `skill:route` npm script). The contract
  parser runs over real SKILL.md files; the ranker over real `loadSkills` output.
- [x] No criterion was verified via a bypassing surface.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| parseFrontmatter handles inline + block arrays + folded scalars on real files | Confirmed (#1 — all 14 parsed, capabilities/triggers populated) | — |
| validateSkillFrontmatter is a real gate (rejects 5 malformed shapes) | Confirmed (#1/#2) | — |
| routeTask is deterministic + stable + name-tie-broken | Confirmed (#1/#2) | — |
| No false route on unrelated tasks | Confirmed (#1/#2) | — |
| Ranker resolves every ambiguous neighbor toward intent | Confirmed (R1/R3) — 15/15 after fix; v6-SKILLROUTER-01 resolved | — |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (target test) | ✅ | R3 — 43 passed |
| Dedicated commit + slice id | ⬜ | not committed (per instructions: do NOT commit) |
| **CI green — machine-read at merge** | ⬜ | local run only; not merged this session |
| Migration reversible | n/a | no DB |
| Failure paths → honest error, no false success | ✅ | no-match → []; CLI exits 1 + stderr "no deterministic route" |

## FAIL history
- 2026-06-14 — criterion 2 FAIL: 1/14 verifier route cases (production-readiness-review) misroutes to
  cutover-execution. Filed as v6-SKILLROUTER-01 author-ward; the permanent test PINS the current behavior
  (annotated KNOWN DEFECT) so CI stays honest-green and trips when the scorer is fixed. Awaiting
  author fix + re-verification (move the pinned case into ROUTE_CASES).
- 2026-06-14 (later, RESOLVED) — author deduped per-token scoring in `scoreSkill`. Independent re-execution:
  15/15 route cases pass, the formerly failing case routes production-readiness-review (6.5) > cutover (3.0,
  margin 3.5), no regression on cutover/migration/verify neighbors. KNOWN-DEFECT test block REMOVED and the
  case migrated into `ROUTE_CASES` (passing) + a dedicated regression guard added. `npx vitest run
  tests/skill-router.test.ts` → 43 passed. Criterion 2 now PASS; verdict re-issued `verified`.

## Bug reports
1. **[Should-fix · RESOLVED 2026-06-14] v6-SKILLROUTER-01 — `scoreSkill` over-rewards a generic token repeated across triggers.**
   **Resolution (independently re-verified):** `scoreSkill` now builds per-skill `trigTokens`/`capTokens` Sets,
   so each distinct task-token is credited at most once per skill (capabilities deduped against triggers too).
   The repeated `production` token no longer stacks; the repro routes correctly with margin +3.5. All 15 cases
   pass; no regression on the cutover/migration/verify neighbors. Vitest 43 passed. Closed.

   --- original report (preserved) ---
   `scoreSkill` over-rewards a generic token repeated across triggers.
   Repro: `routeTask("are we cleared to promote this build to production", loadSkills("<proj>/.claude/skills"))`
   → `cutover-execution` (10) over `production-readiness-review` (6.5).
   Cause (`templates/tools/skill-route.mjs` line ~48): `score += 3 * hit.length` is summed per trigger with
   no per-token cap, so the same token (`production`) in 3 triggers contributes 9. A whole-phrase/trigger
   match is not weighted above scattered token overlap.
   Suggested fix (author's call): cap each distinct task-token's trigger contribution per skill to one hit,
   and/or raise the relative weight of phrase matches vs single-token overlap. Re-verify against the full
   14-case corpus; the production-readiness case should then route correctly with a positive margin.
   → back to the author.
