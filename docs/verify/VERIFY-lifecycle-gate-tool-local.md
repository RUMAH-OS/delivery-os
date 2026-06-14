---
slice: "lifecycle-completeness-gate (v6 #16)"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent invocation, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node --input-type=module -e \"import('./templates/tools/lifecycle-gate.mjs').then(m=>{const f=[{name:'c',steps:[{name:'reinstate',expected:['contract.reinstated'],emitted:['contract.reinstated']}]}];const b=[{name:'c',steps:[{name:'reinstate',expected:['contract.reinstated'],emitted:[]}]}];process.exit(m.validateLifecycles(f).ok && !m.validateLifecycles(b).ok ? 0 : 1)})\""
---

# VERIFY — Slice lifecycle-completeness-gate (v6 #16) — canonical validator (delivery-os)

## Verdict
**verify_status:** `verified`  ·  one line: the canonical pure validator `validateLifecycles` returns `ok:true` for a faithful lifecycle and `ok:false` with the correct, named violation for each failure class (missing-inverse / mutating-no-event / forbidden-leak); the consumer repo's live LC-1 RED (sibling doc) proves the same validator catches a real regression through the real app.

## Independence header  (Governance §3/§12)
- Verifier identity / invocation: qa-test subagent · distinct invocation 2026-06-14 · NOT the build session.
- Author identity (code under test): claude-opus main build session 2026-06-14.
- [x] I assert: the verifier did **not** author this validator.
- [x] Independence was **real**: the verifier imported the module itself and the live RED in the consumer repo was reproduced by the verifier.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 6 | `node --input-type=module` importing `./templates/tools/lifecycle-gate.mjs` and calling `validateLifecycles` on four cases | 0 | see below |
| 4* | (consumer repo) live LC-1 mutation → `npm run lifecycle:check` | 1 | RED naming `contract/reinstate` + missing `contract.reinstated` (see rumah-admin VERIFY) |

### Criterion 6 — verbatim direct-import output
```
faithful {"ok":true,"violations":[]}
missingInverse {"ok":false,"violations":["[c] c/reinstate: declared lifecycle event \"contract.reinstated\" was NOT emitted when the transition ran (incomplete lifecycle — a real operator/founder/customer would experience a broken workflow)"]}
mutNoEvent {"ok":false,"violations":["[c] c/reinstate: mutating transition declares NO expected event (LC-1 smell — declare its event, or set noEvent:\"<reason>\")"]}
leak {"ok":false,"violations":["[c] c/reinstate: forbidden event \"contract.terminated\" WAS emitted (lifecycle leak — this transition must not produce it)"]}
```

## Acceptance criteria
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 6 | faithful → ok:true | direct ESM import of the canonical validator | #6 (`faithful ok:true`) | PASS |
| 6a | missing-inverse step → ok:false, right violation | same | #6 (`missingInverse … NOT emitted`) | PASS |
| 6b | mutating-no-event step → ok:false, right violation | same | #6 (`mutNoEvent … declares NO expected event`) | PASS |
| 6c | forbidden-leak step → ok:false, right violation | same | #6 (`leak … forbidden … contract.terminated`) | PASS |
| (cross) | the SAME validator catches a real regression on a real app | consumer repo `npm run lifecycle:check` live LC-1 RED | sibling rumah-admin VERIFY #4a (exit 1) | PASS |

## Surface statement
- The slice's real surface (here): the pure, zero-dependency validator imported directly. Driven by: a fresh `node` import in the delivery-os repo, no app/DB.
- [x] No criterion verified via a bypassing surface — the validator was executed, not read. Its real-path teeth are proven independently in the consumer repo (live source mutation), not only in fixtures.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Validator distinguishes all three failure classes with distinct, named messages | Confirmed (#6) | Blocker — met |
| Validator is the SAME bytes the consumer real-path gate runs | Confirmed (rumah-admin driver imports `../../delivery-os/templates/tools/lifecycle-gate.mjs` by relative path; live RED uses it) | Blocker — met |
| `validateLifecycles` namespaces per-lifecycle | Evidence-backed (`[c]` prefix in #6; unit test in consumer repo asserts aggregation) | Safe-to-defer |
| Verifier left delivery-os source unmutated | Confirmed (`git status`: only `templates/tools/lifecycle-gate.mjs` untracked — the slice artifact) | Blocker — met |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #6 (module imports + runs) |
| Dedicated commit + slice id | ⬜ | not committed (verifier does not commit; artifact untracked) |
| CI green — machine-read at merge | ⬜ | local-only verification (`-local`); machine_probe above is the re-executable check |
| Migration reversible / fresh-DB | n/a | pure tool, no migration |
| Failure paths → honest error, no false success | ✅ | #6 — three failure classes each refuse with a named violation |

## FAIL history
- none — passed on first independent run.

## Bug reports
1. [Safe-to-defer] The CLI runner's `resolveArg` path-compare for direct-vs-imported detection is platform-sensitive; on this run the consumer drove the gate via `spawnSync(node, [GATE])` so the CLI branch fired correctly (exit 0/1 observed). No defect surfaced — noted only as a watch item for exotic path forms. → informational, to the author.
