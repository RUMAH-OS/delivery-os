---
slice: engine-g4-verdict-projection
verify_status: verified
author: "implementation-session"
verifier: "independent-qa-subagent"
date: 2026-06-24
independence_basis: recorded-distinct-invocation
---

# VERIFY — G4: surface the verifier verdict on the engine run-read projection

## Independence header
This verification was performed by an independent QA invocation that did NOT author the
G4 change (author ≠ verifier, Delivery OS Governance §3/§12). No production code was
modified by the verifier. Evidence below is from direct reads of the canonical engine
source and a verbatim, independently-run consumer typecheck.

## Change under test
`templates/workflow-engine/workflow-route.ts` — `GET /workflow/runs/:id` (gated on
`workflow:observe`). The projection now adds:
- a top-level `verify` object derived from the `engine.verify` step's stored verdict, or `null`;
- `verdict: s.verdict ?? null` on each projected step.

## Per-claim verdicts

### 1. Shape-match (projected fields ⊆ actual storedVerdict) — PASS
The stored verdict is built at `engine.ts:418–423`:
```
storedVerdict = { ...verdict, verifierId: defStep.verifierId, rung,
                  gateEligible: gate.eligible, gateReason: gate.reason, advisory: [...] }
```
where `...verdict` is a `Verdict` (`verifiers.ts:45–51`: `verdict`, `score?`, `confidence?`,
`reasons: string[]`, `suggestedImprovement?`).
The projection (`workflow-route.ts:115–117`) surfaces exactly:
`verdict`, `reasons`, `rung`, `verifierId`, `gateEligible`, `gateReason`.
Every one of these is present on `storedVerdict`. No phantom fields.
The verify step is located by `s.handler === "engine.verify"` (`workflow-route.ts:106`),
which matches the engine's own dispatch key (`engine.ts:287`). The backing column is
`workflowStep.verdict` jsonb (`schema.ts:74`). CONFIRMED.

### 2. PII-safety — PASS (top-level `verify`), with one advisory on `step.verdict`
- Top-level `verify`: surfaces only typed coded fields — `reasons` is `string[]`
  documented S4 coded/PII-free (`verifiers.ts:49`), `rung`/`verifierId` are codes,
  `gateEligible` is boolean, `gateReason`/`verdict` are coded strings. Provably PII-free
  by type contract. It deliberately does NOT surface `score`, `confidence`,
  `suggestedImprovement`, or `advisory`. PASS.
- Per-step `verdict: s.verdict ?? null` (`workflow-route.ts:119`): surfaces the FULL stored
  jsonb, which includes `suggestedImprovement` (type `unknown`, the one Verdict field with
  NO type-level PII guarantee) and the `advisory[]` array. The S4 guarantee covers `reasons`
  only. The engine documents the verdict column as PII-free by construction
  (`engine.ts:415`), and the demo verifier complies (`src/demo-pack/demo-ping.ts:74–75` emits
  coded reasons only, no `suggestedImprovement`). No PII leaks for compliant verifiers.
  ADVISORY (low severity): a domain verifier that writes non-coded content into
  `suggestedImprovement` would have it exposed on the `workflow:observe` surface via the raw
  per-step `verdict`. This is a wider surface than the top-level `verify` claim. Recommend the
  engine either (a) project a coded subset on `step.verdict` too, or (b) make the
  PII-free-by-construction obligation on `suggestedImprovement` explicit in the verifier
  contract. Not a blocker for G4 (the founder surface reads top-level `verify`, which is safe).

### 3. Backward-compat — PASS
Both additions are additive. `verifyStep` is `undefined` until an `engine.verify` step has
run, so `vv` is `null` → `verify: null` (`workflow-route.ts:106–118`). Per-step `verdict`
defaults to `null` via `s.verdict ?? null`. No existing field renamed/removed; existing
consumers reading `id`/`state`/`steps[]` are unaffected. CONFIRMED.

### 4. Consumer typecheck — PASS
The canonical change was synced into the demo-app's vendored
`.claude/os/engine/workflow-route.ts`; verifier confirmed it is byte-identical to canonical
(`diff` → IDENTICAL).

Verbatim execution:
```
$ cd C:/Users/brian/RUMAH/delivery-os/examples/engine-demo-app && npx tsc --noEmit; echo "EXIT_CODE=$?"
EXIT_CODE=0
```
Compiles clean against real deps. PASS.

## Bugs
None blocking.

## Risks / advisories
- LOW: per-step `verdict` projection exposes raw `suggestedImprovement` (`unknown`) +
  `advisory[]`; PII-free only by verifier convention, not by type. See claim 2.

## Honest limits
This verification is STATIC: types + shape-correctness + PII-safety by contract. It does NOT
exercise a live HTTP request returning a populated `verify` (no running server/DB here).
Follow-up integration check recommended: enqueue a run → tick to the `engine.verify` step →
`GET /workflow/runs/:id` → assert `verify.verdict` is present and equals the stored verdict,
`verify` is `null` before the verify step runs, and each step's `verdict` round-trips.

## Verdict
verify_status: **verified** — shape-match, top-level PII-safety, backward-compat, and consumer
typecheck all PASS. One low-severity advisory on the raw per-step `verdict` surface noted above.
