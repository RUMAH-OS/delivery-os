---
slice: "seam-contract-reinstated — contract.reinstated registry entry in admin-plos-seam-v1.mjs"
verify_status: verified
author: "claude-opus main build session 2026-06-14"
verifier: "qa-test subagent (independent invocation, 2026-06-14)"
date: "2026-06-14"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node contracts/__verify_reinstated.mjs  (exit 0 = all 8 hold; temp script removed post-run — re-create from this doc to re-probe, or fold the 8 asserts into a contracts/ unit test)"
---

# VERIFY — Slice seam-contract-reinstated (contract.reinstated registry entry)

## Verdict
**verify_status:** `verified`  ·  one line: all 8 criteria PASS against the live pure-function module; `contract.reinstated` behaves exactly like a ref-only fact type (strict required set, unknown-field reject, PII reject), siblings + SEAM_VERSION unaffected.
> A verdict of `verified` is permitted ONLY if every acceptance criterion PASSes on its OWN surface, every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and the verifier was a REAL distinct lens from the author.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: qa-test subagent · distinct recorded invocation · 2026-06-14 (NOT the main build session)
- Author identity (code under test): claude-opus main build session 2026-06-14 (added the REGISTRY entry)
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation, not the same context restyled).

## Execution evidence  (Governance §1 — direct runtime output, never a description of what *would* happen)
| # | Command | Exit | Output (verbatim / log path) |
|---|---------|------|------------------------------|
| 1 | `node contracts/__verify_reinstated.mjs` | 0 | see verbatim block below |

```
--- Criterion 1: well-formed contract.reinstated passes ---
  expected ok=true got ok=true  extraCheck=true
  violations=[]
  => PASS
--- Criterion 2: missing required tenantId -> rejected ---
  expected ok=false got ok=false  extraCheck=true
  violations=["payload: missing required field \"tenantId\""]
  => PASS
--- Criterion 3: extra unknown field terminatedOn -> rejected (refs-only, no drift) ---
  expected ok=false got ok=false  extraCheck=true
  violations=["payload: unknown field \"terminatedOn\" (per-type shape is strict — add it to the seam contract deliberately)"]
  => PASS
--- Criterion 4: PII field email -> rejected ---
  expected ok=false got ok=false  extraCheck=true
  violations=["payload: unknown field \"email\" (per-type shape is strict — add it to the seam contract deliberately)","PII: forbidden field \"payload.email\" (data-minimisation: the seam carries refs, not tenant PII)"]
  => PASS
--- Criterion 5: unknown type contract.foobar -> rejected ---
  expected ok=false got ok=false  extraCheck=true
  violations=["type \"contract.foobar\": unknown event type — not in the seam contract (add it deliberately)"]
  => PASS
--- Criterion 6: regression: contract.terminated still passes ---
  expected ok=true got ok=true  extraCheck=true
  violations=[]
  => PASS
--- Criterion 7: SEAM_VERSION still "v1" ---
  SEAM_VERSION="v1"
  => PASS
--- Criterion 8: batch [reinstated, terminated] -> ok:true ---
  expected ok=true got ok=true  extraCheck=true
  violations=[]
  => PASS

=== OVERALL: ALL PASS ===
EXIT=0
```

> The temp script `contracts/__verify_reinstated.mjs` imported the canonical module by `file://` URL (the real exported pure functions — not a re-implementation) and was removed after the run per scope. The 8 fixtures use fixed valid UUIDs/ISO instants; no shared store/queue/port is touched (pure functions, no I/O), so no run-unique-token guard is required.

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | Well-formed `contract.reinstated` → `{ok:true, violations:[]}` | imports module, calls `validateSeamEvent` | #1 | PASS |
| 2 | Drop required `tenantId` → `ok:false` + "missing required field" | `validateSeamEvent` | #1 | PASS |
| 3 | Extra `terminatedOn` → `ok:false` + "unknown field" (refs-only, no termination-data drift) | `validateSeamEvent` | #1 | PASS |
| 4 | PII `email` in payload → `ok:false` + PII violation | `validateSeamEvent` | #1 | PASS |
| 5 | Unknown type `contract.foobar` → `ok:false` "unknown event type" | `validateSeamEvent` | #1 | PASS |
| 6 | Regression: well-formed `contract.terminated` still passes | `validateSeamEvent` | #1 | PASS |
| 7 | `SEAM_VERSION === "v1"` (additive, no bump) | exported const | #1 | PASS |
| 8 | `validateSeamBatch([reinstated, terminated])` → `ok:true` | `validateSeamBatch` | #1 | PASS |

> Criterion 3 is the load-bearing one: the strict unknown-field reject proves `contract.reinstated` stays a flat refs-only fact and cannot silently carry termination data into a fat payload.

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: the canonical pure-function ESM module `contracts/admin-plos-seam-v1.mjs`. Driven by: a Node ESM script that `import`s the actual exported `validateSeamEvent` / `validateSeamBatch` / `SEAM_VERSION` and runs them — the production functions themselves, not a stand-in.
- [x] No criterion was "verified" via a surface that bypasses the slice. The module IS the slice; it was executed, not merely read.

## Classified open assumptions  (every claim the verdict rests on)
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| `contract.reinstated` REGISTRY entry = `{required:[contractId,tenantId,propertyId], optional:[]}` | Confirmed (read L122–125 of module) | — |
| All 8 behaviours hold at runtime | Evidence-backed (#1, exit 0) | — |
| Change is additive (no SEAM_VERSION bump) | Evidence-backed (#1, crit 7) | Safe-to-defer |
| Sibling `contract.terminated` unaffected | Evidence-backed (#1, crit 6) | — |

> No load-bearing claim is below Evidence-backed → `verified` is permitted.

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (module imports + runs) | ✅ | #1 exit 0 |
| Dedicated commit + slice id (or NO-GIT flagged) | ⬜ | NO-GIT: task instruction is "do NOT commit" — this VERIFY doc records the run |
| CI green — machine-read at merge | ⬜ | N/A — no merge performed (verify-only task) |
| Migration reversible + applies-clean-on-fresh-DB | n/a | no migration in this slice (pure-function contract change) |
| Failure paths → honest error, no false success | ✅ | crit 2/3/4/5 each return ok:false with a precise violation (#1) |
| Canonical (single source of truth respected) | ✅ | edit lives in the canonical delivery-os contract module, deliberate registry add |

## FAIL history
- none

## Bug reports
1. none — all criteria passed; no defects to route author-ward.
