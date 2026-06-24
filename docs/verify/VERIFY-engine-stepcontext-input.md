---
artifact: G1 — canonical workflow-engine threads run.input into StepContext.input (handlers.ts + engine.ts; re-vendored to rumah-admin + property-lead-os; PLOS dunning pack sources email from ctx.input.email)
verify_status: verified
verdict: PASS
date: 2026-06-24
author: software-engineer
verifier: qa-test independent
author_ne_verifier: true
scope: >
  Independent off-prod verification (throwaway DBs, no commit, no redeploy). Confirms the canonical engine
  now threads the run's enqueue input into every handler ctx (regular + await-callback), byte-identical
  re-vendor across delivery-os/rumah-admin/property-lead-os with drift green in both apps, engine behaviour
  unchanged, the new ctx.input capability proven, the PLOS dunning pack driven by per-run email, frozen
  logic untouched, and clean typecheck/build. Test DB reset (down/up/migrate) between each engine proof.
---

# VERIFY — engine StepContext.input threading (G1)

**VERDICT: PASS** — every acceptance criterion met, proven independently of the author's word, on freshly
reset throwaway DBs. No production code touched, no commit, no redeploy. Both throwaway DBs torn down.

One-line: Yes — the engine now threads `run.input` to handlers (proven: handler sees exactly the enqueued
input, `{}` for empty, per-run isolated), with engine behaviour unchanged, byte-identical re-vendor +
drift green in both apps, and the PLOS dunning driven by per-run email (no `input.email` → no draft; with
`input.email` → draft; both noSend).

## Method (distrust-the-report posture)
- Read the actual source (handlers.ts StepContext field; engine.ts `loadRunInput` + both population sites)
  before trusting the claim — the code matches the claim exactly.
- Read the proof scripts (engine-input-proof.ts, b1-app-path-e2e.ts perRunInput) to confirm they prove the
  claim rather than assert it: both read committed DB state back out and compare deep-equal; the perRunInput
  proof varies ONLY `input.email`.
- RESET the Admin test DB (`db:test:down && db:test:up && db:test:migrate`) before EACH engine proof
  (proof-isolation quirk). PLOS e2e manages its own throwaway DB (port 55434, db plos_engine_proof).

## Per-criterion verdicts + real output

### C1 — Byte-identical + drift green — PASS
`diff` clean and SHA256 identical across delivery-os (canonical) / rumah-admin / property-lead-os:
```
engine.ts   1dfa3591d50200a43dbd513a2f5968b5eecd76a2d5cb1d4f9c54d403ae14a285  (all 3 identical)
handlers.ts 0765e502edb82ea85ef7ea60f02a5de5bc00487c4b72c039b2896d91e6a0718b  (all 3 identical)
```
INHERITED-engine.json sha records refreshed (recorded == computed): engine.ts `1dfa3591…`, handlers.ts `0765e502…`.

Drift check (engine-check) PASS exit 0 in BOTH apps:
```
ADMIN: os-inherit engine-check · OS v5.0-131-gb7c7d0c · 27 installed engine file(s)
  PASS: every installed engine is byte-current with canonical ... DDL structurally equivalent.  EXIT 0
PLOS:  os-inherit engine-check · OS v5.0-131-gb7c7d0c · 27 installed engine file(s)
  PASS: every installed engine is byte-current with canonical ... DDL structurally equivalent.  EXIT 0
```
Claimed code verified present in canonical source:
- handlers.ts:28 `readonly input: Record<string, unknown>;` on StepContext.
- engine.ts:695 `async function loadRunInput(tx, runId)` reading `workflowRun.input`, `{}` default.
- engine.ts:311 (regular handler sctx) and engine.ts:577 (await-callback sctx) both set `input: runInput`.

### C2 — Engine behaviour unchanged — PASS (each on a FRESH reset DB)
- `engine:proof` → ALL PROOFS PASS (exit 0). #1 unattended terminal, #4 kill-mid-step re-lease (exactly one
  invoice, one event, dead lease committed nothing), #5 transient-fail → retry → recovered, C6 irreversible →
  blocked + escalated + no number, illegal-edge refused by DB trigger.
- `engine:loop:proof` → ALL SLICE-1 PROOFS PASS (exit 0). Verify-loop/retry/stop, human gate cap unbypassable,
  service/PLOS tokens 403, invalid callbacks 404/400 with no audit, valid approve resolves + audits the human
  principal, duplicate callback idempotent, reject → failed.
- `engine:verifier:real:proof` → ALL SLICE-B REAL VERIFIER PROOFS PASS (exit 0). Real T4 judge rejects attempt
  1 (needs_improvement) → improve back-edge → attempt 2 commits the "## Edge Cases" fix → judge accepts (pass)
  → loop stops → run completed.

### C3 — ctx.input reaches handlers (the new capability) — PASS
`engine:input:proof` (rumah-admin, fresh DB) → ALL G1 INPUT PROOFS PASS (exit 0):
```
[#1] handler observed non-empty ctx.input (keys=email,scenario); deep-equals the enqueued input.
[#2] empty-input run sees {} (not undefined/null).  seen={}
[#3] run A saw {"run":"A","value":111}; run B saw {"run":"B","value":222}; the two did NOT share input.
```
The proof imports the REAL vendored engine, registers an echo handler, and reads the committed
`workflow_step.result` back from the DB — genuine proof, not an in-memory assertion.

### C4 — Dunning uses per-run email — PASS
PLOS `run-b1-e2e.mjs` → DRIVER RESULT: migrate=OK auth=PASS paid=PASS unpaid=PASS perRunInput=PASS (exit 0):
```
[perrun:default-no-input]  state=completed decision=gated            draftPrepared=false noSend=true
[perrun:with-input-email]  state=completed decision=reminder_prepared draftPrepared=true  noSend=true
PER-RUN-INPUT -> default(no-input) drafted=false | with-input drafted=true -> PASS  reasons=[]
```
The ONLY difference between the two runs is whether `input.email` was supplied → drafting only when supplied
proves ctx.input drives the dunning email. Both runs noSend=true (no_send_no_money). paid → no_action_all_paid
(STOP); unpaid (closure default) → reminder_prepared. Throwaway DB destroyed on teardown.

### C5 — Frozen logic untouched — PASS
`git diff` on `packages/engine-install/src/mailbox-pack/mailbox-intelligence.ts` shows only: a new
`DunningRunInput` shape + `emailForRun(ctx, deps)` (prefers `ctx.input.email`, falls back to `deps.email`,
defensive on malformed input), and `resolveRefs` taking the resolved email so its 4 call-sites pass
`emailForRun(ctx, deps)`. The frozen `resolveEntities` / `prepareDunningAction` are defined in
`apps/web/lib/mailbox-entity-resolve.ts` and `apps/web/lib/mailbox-dunning.ts` — both show NO diff (unchanged).
`apps/web/lib/mailbox-*` unchanged.

### C6 — Typecheck / build — PASS
- Admin `npm run build` (`tsc -p tsconfig.json`) → EXIT 0 (clean).
- PLOS `pnpm -r typecheck` → all 12 workspace projects Done, EXIT 0.

## Provenance / safety
- No commit, no redeploy. HEADs unchanged: admin 241a923, plos 6f3044c, delivery-os b7c7d0c. Changes are
  working-tree only (re-vendor + pack edit), as expected off-prod.
- Throwaway DBs only (admin localhost:55432 rumah_admin_test; PLOS 55434 plos_engine_proof). Both torn down;
  `docker ps` shows no remaining throwaway engine DBs.

## Concerns
None blocking. Minor note: the canonical `loadRunInput` issues one extra per-step SELECT on `workflow_run.input`
inside the lease txn (regular + await paths). Correctness is unaffected and it is localized; if step throughput
ever matters it could be folded into the lease query, but that is an optimization, not a defect.
