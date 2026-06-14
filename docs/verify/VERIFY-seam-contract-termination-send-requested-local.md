---
slice: "termination-send-requested — canonical seam contract entry (delivery-os)"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent invocation, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node docs/../scripts (see below) — re-runnable: import { validateSeamEvent } from contracts/admin-plos-seam-v1.mjs and assert a valid termination.send_requested ok=true, a dropped required field ok=false. (Verifier ran this as a temp probe; exit 0 = still enforcing.)"
---

# VERIFY — Slice termination-send-requested (canonical seam contract)

## Verdict
**verify_status:** `verified` · The CANONICAL pure-function contract
(`contracts/admin-plos-seam-v1.mjs`) registers `termination.send_requested` with
required `{contractId, tenantId, propertyId, terminatedOn}` and optional `{reason, noticeGivenOn}`,
and `validateSeamEvent` enforces it correctly: valid → ok; missing required → violation; unknown field →
violation; PII field → violation; optionals-omitted → still ok. Proven by importing the module directly.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct invocation 2026-06-14 ~19:48 local · NOT the build session.
- Author identity (code under test): claude-opus main build session 2026-06-14.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real**: the verifier wrote and ran its own `_qa-contract-fn.mjs` (since deleted) importing the canonical module.

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim) |
|---|---------|------|-------------------|
| 1 | `node scripts/_qa-contract-fn.mjs` (imports `../../delivery-os/contracts/admin-plos-seam-v1.mjs`; temp, deleted) | 0 | 5/5 PASS, below |
| 2 | `npm run seam:check` (Admin, drives the real path, runs the batch through delivery-os's `templates/tools/seam-gate.mjs` → this contract) | 0 | `seam-gate · contract v1 · 13 event(s) · …admin-plos-seam-v1.mjs` · `PASS: all 13 event(s) conform`; batch histogram contained `termination.send_requested: 1` |

### Pure-function enforcement (cmd #1) verbatim
```
PASS | valid full payload -> ok | ok=true (expect true) | violations=[]
PASS | drop required terminatedOn -> violation | ok=false (expect false) | violations=["payload: missing required field \"terminatedOn\""]
PASS | add unknown field foo -> violation | ok=false (expect false) | violations=["payload: unknown field \"foo\" (per-type shape is strict …)"]
PASS | add PII field email -> violation | ok=false (expect false) | violations=["payload: unknown field \"email\" …","PII: forbidden field \"payload.email\" (data-minimisation …)"]
PASS | optionals omitted (reason+noticeGivenOn) -> ok | ok=true (expect true) | violations=[]
```
Note: an injected `email` is rejected TWICE (strict-unknown AND PII deny-list) — stronger than the single-violation minimum the criterion asks for.

> Machine-guard line: the contract module is pure (no I/O, zero deps); enforcement is deterministic and needs no shared resource. The seam:check cross-check (cmd #2) touched the shared local test DB and used a fresh "now" cursor + 2080+ unique periods, so it judged only that run's emitted batch.

## Acceptance criteria  (criterion 5 of the slice)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 5a | valid termination.send_requested → ok | `import validateSeamEvent` | #1 | PASS |
| 5b | drop required `terminatedOn` → violation | imports the module | #1 | PASS |
| 5c | add an unknown field → violation | imports the module | #1 | PASS |
| 5d | add a PII field (`email`) → violation | imports the module | #1 | PASS |
| 5e | only the optionals omitted → still ok | imports the module | #1 | PASS |
| — | the contract is the one the live producer gate uses | seam-gate runner imports this exact file | #2 | PASS |

## Surface statement
- The slice's real surface (delivery-os side): the executable contract `contracts/admin-plos-seam-v1.mjs` and its `validateSeamEvent` / `validateSeamBatch`. Driven by direct `import` (the same bytes the seam-gate and both repos consume).
- [x] No criterion was verified via a surface that bypasses the slice — the contract was imported and called, not read.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| registry entry: required = 4 refs+terminatedOn, optional = reason+noticeGivenOn | Confirmed (#1) | Blocker-if-wrong → OK |
| strict per-type shape rejects unknown fields | Confirmed (#1) | Blocker-if-wrong → OK |
| PII deny-list catches `email` | Confirmed (#1) | Blocker-if-wrong → OK |
| this file is the one the producer gate runs | Confirmed (#2 — seam-gate header prints this path) | Blocker-if-wrong → OK |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1 module imports + runs clean |
| Dedicated commit + slice id | ⬜ | not committed per instruction |
| CI green — machine-read at merge | ⬜ | not run by verifier (local verification) |
| Migration reversible / fresh-DB | n/a | doc/code-only, no schema |
| Failure paths → honest error, no false success | ✅ | #1 — every malformed/PII/unknown case yields an explicit violation, never a silent ok |
| Canonical contract enforced | ✅ | #1 pure-fn; #2 the live gate runs this file |

## FAIL history
- none.

## Bug reports
- none.
