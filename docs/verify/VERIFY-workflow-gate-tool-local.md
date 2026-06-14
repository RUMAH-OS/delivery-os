---
slice: "cross-repo-workflow-gate (v6 #16 cross-repo) — canonical workflow-gate validator (delivery-os)"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent invocation, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node --input-type=module -e \"import {validateWorkflows} from './templates/tools/workflow-gate.mjs'; const r=validateWorkflows([{name:'w',steps:[{name:'i',repo:'admin',ok:true,link:{to:'e',field:'eventId',a:'A',b:'B'}}]}]); process.exit(r.ok?1:0)\"  # exit 0 = broken-linkage still caught"
---

# VERIFY — Slice cross-repo-workflow-gate (v6 #16 cross-repo) — workflow-gate validator

## Verdict
**verify_status:** `verified`  ·  the canonical pure validator (`validateWorkflow` / `validateWorkflows` /
`WORKFLOW_GATE_VERSION`) correctly distinguishes proven, honest-partial, and failed cross-repo workflows; it
catches a broken seam round-trip, a failed driven step, a silent gap, and a peer step with no obligation, and
reports open peer obligations as `ok:true / fullyProven:false` (honest scope, not a green fake). Proven both by
the consumer's adversarial unit suite (9/9) and by the verifier's own direct import.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct invocation · 2026-06-14 — NOT the build session.
- Author identity (code under test): claude-opus main build session 2026-06-14.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation; the verifier ran the validator directly and observed verdicts).

## Execution evidence  (Governance §1 — direct runtime output)
> Machine-guard line: pure, zero-dep validator — no shared store/port. Probed by direct ESM import (no fixtures).

| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `npx vitest run tests/workflow-gate-unit.test.ts` (in rumah-admin, imports this gate by relative path) | 0 | `Test Files 1 passed (1) · Tests 9 passed (9)` |
| 2 | `node -e "import {validateWorkflows} …"` direct probe of the four classes (in delivery-os) | 0 | see block below |

### Direct-import probe (cmd 2) — verbatim
```
OPEN-OBLIGATION: {"ok":true,"fullyProven":false,"obligations":["w/plos [peer]: PLOS does x"]}
BROKEN-LINKAGE: {"ok":false,"violations":["[w] w/ingest: BROKEN seam linkage — eventId (\"aaaa-1\") != step \"emit\".eventId (\"DIFFERENT\") — the handoff does not round-trip"]}
FAILED-DRIVEN: {"ok":false,"violations":["[w] w/s: driven step did not succeed (ok=false, orphan 201)"]}
PEER-NO-OBLIGATION: {"ok":false,"violations":["[w] w/plos: peer step must name its obligation (what the peer repo must conformance-prove)"]}
EXIT=0
```

## Acceptance criteria  (the validator-directness slice — criterion 6 of the cross-repo gate)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 6a | open obligation → ok:true, fullyProven:false (honest partial) | direct import | #2 | PASS |
| 6b | broken seam linkage (a !== b) → ok:false + BROKEN-linkage violation | direct import | #2 | PASS |
| 6c | failed driven step (ok!==true) → ok:false + "did not succeed" | direct import | #2 | PASS |
| 6d | peer step lacking an obligation → ok:false + "must name its obligation" | direct import | #2 | PASS |
| 2  | adversarial unit suite all pass (incl. all classes above + silent gap + version v1) | vitest over this gate | #1 | PASS |

## Surface statement  (anti-Slice-1.0)
- Real surface: the pure ESM module `templates/tools/workflow-gate.mjs`, exercised by importing and calling its
  exported functions directly (not reading the source). The downstream RED-on-the-real-path proof lives in the
  consumer repo's VERIFY (`rumah-admin/docs/verify/VERIFY-cross-repo-workflow-gate-local.md`): with Admin's
  integrity guard removed, the orphan outcome was accepted and this gate forced a non-zero exit.
- [x] No criterion verified via a bypassing surface.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Validator catches all four cross-repo failure classes | Confirmed (#2) | Blocker-class, met |
| Open obligations are honest (ok:true/fullyProven:false), never faked green | Confirmed (#2) | Should-fix-class, met |
| Gate forces a non-zero CLI exit on violation when driven by a real consumer | Confirmed (consumer VERIFY cmd 4, exit 1) | Blocker-class, met |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1 unit suite 9/9 |
| Dedicated commit + slice id | ⬜ | not committed by verifier (per instruction) |
| CI green — machine-read at merge | ⬜ | local-only verification (`-local` doc) |
| Migration … | n/a | pure validator, no DB |
| Failure paths → honest error, no false success | ✅ | #2 — all four failure classes produce explicit violations |

## FAIL history
- none.

## Bug reports
- none. No defects found.
