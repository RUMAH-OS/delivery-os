---
slice: c2-agent-verify-record
verify_status: verified
author: "implementation-session(coordinated)"
verifier: "independent-qa-subagent"
date: 2026-06-24
independence_basis: recorded-distinct-invocation
---

# VERIFY — C2: the engine's `agent → verify → record` chain (off-prod, simulated executor)

## Independence header (author ≠ verifier — Delivery OS §3/§12)

This verification was performed by an **independent QA subagent invocation**, distinct from the
implementation session that authored the slice. The verifier did **not** author any of the slice's
implementation (`src/demo-pack/demo-agent.ts`, `src/engine-app/runtime.ts`, `run-agent-demo.ts`,
`package.json`). The verifier **did not modify the implementation**; the only file added is an
independent QA black-box probe under the QA-owned `tests/` tree
(`examples/engine-demo-app/tests/verifier-rigor.probe.ts`).

- Slice under verification: branch `feat/c2-agent-verify-record-demo`, commit `dd9ec50`.
- The author's run log was **not trusted** — the proof + typecheck were **re-run from a clean throwaway
  DB by the verifier** and the VERBATIM output is reproduced below.
- Environment: Windows 10, Docker 24.0.2, Postgres 16-alpine (`engine-demo-app-db-1`, healthy), tsx.

---

## Method

1. `npm run db:up` → throwaway Postgres up + healthy.
2. `npm run agent-demo` (`tsx run-agent-demo.ts`) — applies the canonical engine DDL (incl.
   `0003_engine_agent_runner` + `0004_engine_agent_id`) to a fresh DB, then drives the three cases.
   Exit 0, all GREEN (verbatim below).
3. `npm run typecheck` (`tsc --noEmit`) — exit 0, clean.
4. **Independent adversarial probe** (verifier-authored): directly invokes the shipped T1 verifier
   `demo.agent-result-verifier` against four inputs to disprove the rubber-stamp hypothesis (below).

---

## VERBATIM run output — `npm run agent-demo` (exit 0)

```
> engine-demo-app@0.0.0 agent-demo
> tsx run-agent-demo.ts

──────────────────────────────────────────────────────────────────────────────
ENGINE-DEMO-APP — C2 off-prod proof: the engine's agent -> verify -> record chain (SIMULATED executor)
──────────────────────────────────────────────────────────────────────────────
[0] migrate throwaway DB (app applies the canonical engine DDL incl. 0003/0004 runner+agent_id):
  applied 0000_app_role.sql
  applied 0001_engine_core.sql
  applied 0001a_app_outbox.sql
  applied 0002_engine_await_loop.sql
  applied 0003_engine_agent_runner.sql
  applied 0004_engine_agent_id.sql
    enqueue allow-list DERIVED from registered packs: [demo-ping, demo-agent]

──────────────────────────────────────────────────────────────────────────────
CASE 1 — HAPPY PATH: engine emits + blocks; the runner runs the agent; verify confirms the record.
──────────────────────────────────────────────────────────────────────────────
    enqueue('demo-agent') runId=e9c4c98b-cdee-4d0e-9709-ae9f09b64785

[a] tick until seq-1 BLOCKS on agent-result (the engine emits + blocks — it does NOT run the agent):
    [drive] tick 0: queued -> planned  (materialized 3 steps)
    [drive] tick 1: planned -> executing  (step 0 (demo-agent.request) done)
    [drive] tick 2: executing -> blocked  (await-callback seq 1 -> blocked on agent-result (eventId 13d3b01c-6ea5-4632-86c5-6745e270e479))
ASSERT run reached 'blocked' (engine emitted+blocked) -> PASS (got 'blocked')

[b] agentRunner.runOnce() — claim (SKIP-LOCKED) + run the agent's executor + complete + record agent_id:
    runOnce -> {"kind":"completed","runId":"e9c4c98b-cdee-4d0e-9709-ae9f09b64785","seq":1,"agentId":"demo-agent"}
ASSERT runner completed seq-1 via agent 'demo-agent'  -> PASS (got 'completed')

[c] tick runs engine.verify over the agent's RECORDED result -> loop stop -> run completes:
    [verify] tick 0: executing -> executing  (verify pass -> loop stop (seq 2); gate skipped)
    [verify] tick 1: executing -> completed  (run completed)
──────────────────────────────────────────────────────────────────────────────
EVIDENCE (happy path)
   {"seq":0,"handler":"demo-agent.request","state":"done","result":{"requested":true},"verdict":null,"agentId":null,"checkpoint":{"task":{"goal":"produce-demo-artifact","forRun":"e9c4c98b-cdee-4d0e-9709-ae9f09b64785"},"requested":true}}
   {"seq":1,"handler":"demo-agent.await-result","state":"done","result":{"echo":{"task":{"goal":"produce-demo-artifact"},"dispatched":true},"value":"ok","agentId":"demo-agent","runnerId":"demo-runner","producedBy":"demo-agent-sim","resolvedBy":"agent-result"},"verdict":null,"agentId":"demo-agent","checkpoint":{"task":{"goal":"produce-demo-artifact"},"runId":"e9c4c98b-cdee-4d0e-9709-ae9f09b64785","awaiting":true}}
   {"seq":2,"handler":"engine.verify","state":"done","result":{"reasons":["agent_result_recorded","agent_id_resolved"],"verdict":"pass"},"verdict":{"rung":"T1","reasons":["agent_result_recorded","agent_id_resolved"],"verdict":"pass","advisory":[],"gateReason":"rung_exempt","verifierId":"demo.agent-result-verifier","gateEligible":true},"agentId":null,"checkpoint":null}
  outbox: ["workflow.run.queued","workflow.run.planned","agent.task_requested","workflow.step.completed","agent.task.dispatched","workflow.step.blocked","workflow.agent.completed","workflow.verify.completed","workflow.loop.stopped","workflow.run.completed"]
──────────────────────────────────────────────────────────────────────────────
ASSERT run.state === 'completed'                      -> PASS (got 'completed')
ASSERT seq-1 resolved agent_id === 'demo-agent'       -> PASS (got 'demo-agent')
ASSERT verify verdict === 'pass'                      -> PASS (got 'pass')
ASSERT outbox has 'workflow.agent.completed'          -> PASS
ASSERT outbox has 'agent.task_requested'              -> PASS
──────────────────────────────────────────────────────────────────────────────
CASE 2 — ADVERSARIAL: the agent's executor FAILS past the step cap -> run terminal 'failed' (NOT completed).
──────────────────────────────────────────────────────────────────────────────
    enqueue('demo-agent') runId=d45ffa61-0009-4e7f-aed3-a6ffb62a2e77
    [drive] tick 0: queued -> planned  (materialized 3 steps)
    [drive] tick 1: planned -> executing  (step 0 (demo-agent.request) done)
    [drive] tick 2: executing -> blocked  (await-callback seq 1 -> blocked on agent-result (eventId 9de99692-77c8-4e56-9c4f-82588440c98e))
ASSERT run reached 'blocked'                          -> PASS (got 'blocked')

    drive failingRunner.runOnce() until the executor cap trips:
    runOnce 0 -> {"kind":"retry","runId":"d45ffa61-0009-4e7f-aed3-a6ffb62a2e77","seq":1,"attempt":1,"agentId":"demo-agent"}
    runOnce 1 -> {"kind":"failed","runId":"d45ffa61-0009-4e7f-aed3-a6ffb62a2e77","seq":1,"attempt":2,"agentId":"demo-agent"}
──────────────────────────────────────────────────────────────────────────────
   {"seq":0,"handler":"demo-agent.request","state":"done","result":{"requested":true},"verdict":null,"agentId":null,"checkpoint":{"task":{"goal":"produce-demo-artifact","forRun":"d45ffa61-0009-4e7f-aed3-a6ffb62a2e77"},"requested":true}}
   {"seq":1,"handler":"demo-agent.await-result","state":"blocked","result":{"task":{"goal":"produce-demo-artifact"},"dispatched":true},"verdict":null,"agentId":"demo-agent","checkpoint":{"task":{"goal":"produce-demo-artifact"},"runId":"d45ffa61-0009-4e7f-aed3-a6ffb62a2e77","awaiting":true,"agentFailed":true,"runnerAttempt":2}}
   {"seq":2,"handler":"engine.verify","state":"ready","result":null,"verdict":null,"agentId":null,"checkpoint":null}
  outbox: ["workflow.run.queued","workflow.run.planned","agent.task_requested","workflow.step.completed","agent.task.dispatched","workflow.step.blocked","workflow.agent.retry","workflow.agent.failed","workflow.run.failed"]
──────────────────────────────────────────────────────────────────────────────
ASSERT runner reported 'failed' (cap tripped)         -> PASS (got 'failed')
ASSERT run.state === 'failed' (terminal)              -> PASS (got 'failed')
ASSERT run.state !== 'completed' (never falsely completed) -> PASS (got 'failed')
ASSERT outbox has 'workflow.run.failed'               -> PASS
──────────────────────────────────────────────────────────────────────────────
CASE 3 — ADVERSARIAL: NO registered agent serves the required skill -> 'unrouted' terminal (fail-closed).
──────────────────────────────────────────────────────────────────────────────
    enqueue('demo-agent') runId=4ec36e67-ea37-4d06-8398-6be67f128c83
    [drive] tick 0: queued -> planned  (materialized 3 steps)
    [drive] tick 1: planned -> executing  (step 0 (demo-agent.request) done)
    [drive] tick 2: executing -> blocked  (await-callback seq 1 -> blocked on agent-result (eventId 0c0f2e15-5f7e-4b63-bc17-06ebf8f61b26))
ASSERT run reached 'blocked'                          -> PASS (got 'blocked')

    unroutedRunner.runOnce() — requirement resolves to NO agent:
    runOnce -> {"kind":"unrouted","runId":"4ec36e67-ea37-4d06-8398-6be67f128c83","seq":1,"reason":"no-match"}
──────────────────────────────────────────────────────────────────────────────
   {"seq":0,"handler":"demo-agent.request","state":"done","result":{"requested":true},"verdict":null,"agentId":null,"checkpoint":{"task":{"goal":"produce-demo-artifact","forRun":"4ec36e67-ea37-4d06-8398-6be67f128c83"},"requested":true}}
   {"seq":1,"handler":"demo-agent.await-result","state":"blocked","result":{"task":{"goal":"produce-demo-artifact"},"dispatched":true},"verdict":null,"agentId":null,"checkpoint":{"task":{"goal":"produce-demo-artifact"},"runId":"4ec36e67-ea37-4d06-8398-6be67f128c83","awaiting":true,"agentUnrouted":true,"agentUnroutedReason":"no-match"}}
   {"seq":2,"handler":"engine.verify","state":"ready","result":null,"verdict":null,"agentId":null,"checkpoint":null}
  outbox: ["workflow.run.queued","workflow.run.planned","agent.task_requested","workflow.step.completed","agent.task.dispatched","workflow.step.blocked","workflow.agent.failed","workflow.run.failed"]
──────────────────────────────────────────────────────────────────────────────
ASSERT runner reported 'unrouted' (no-match)          -> PASS (got 'unrouted')
ASSERT run.state === 'failed' (fail-closed terminal)  -> PASS (got 'failed')
ASSERT run.state !== 'completed' (no arbitrary agent ran) -> PASS (got 'failed')
ASSERT seq-1 checkpoint marked agentUnrouted          -> PASS (got 'true')
──────────────────────────────────────────────────────────────────────────────
SUMMARY: happy=GREEN  failing-executor=GREEN  unrouted=GREEN
RESULT: GREEN — the engine emitted + blocked; the RUNNER ran the agent + recorded; verify confirmed; both adversarial cases failed-closed.
──────────────────────────────────────────────────────────────────────────────
EXIT_CODE=0
```

`npm run typecheck` → `tsc --noEmit`, **EXIT_CODE=0** (clean).

---

## Per-claim verdicts

### Claim 2 — Happy path (`agent → verify → record`, GREEN) — **PASS**
- run reached `blocked` on the agent-result step driven **only by `tick()`** (engine emitted + blocked): PASS.
- `agentRunner.runOnce()` returned `{kind:"completed", agentId:"demo-agent"}`: PASS.
- after verify ticks → run `completed`: PASS.
- seq-1 (`AGENT_RESULT_SEQ`) recorded `agentId === "demo-agent"` **and** the executor's result survived the
  record path (`producedBy:"demo-agent-sim"`, `resolvedBy:"agent-result"` on seq-1 `result`): PASS.
- verify verdict `=== "pass"` with reasons `["agent_result_recorded","agent_id_resolved"]`: PASS.
- outbox contains `agent.task_requested` **and** `workflow.agent.completed` (full chain:
  `...agent.task_requested → ...step.blocked → workflow.agent.completed → workflow.verify.completed →
  workflow.loop.stopped → workflow.run.completed`): PASS.

### Claim 3 — Adversarial-1: failing executor past cap → terminal `failed`, never `completed` — **PASS**
- runner sequence `retry(attempt 1) → failed(attempt 2)` (cap=2 honored): PASS.
- run terminal `failed`; **never** `completed`; seq-1 left `blocked`-inert with `agentFailed:true`,
  `runnerAttempt:2`; verify step never ran (`ready`); outbox has `workflow.agent.retry`,
  `workflow.agent.failed`, `workflow.run.failed`: PASS.

### Claim 4 — Adversarial-2: no agent serves the skill → `unrouted`, fail-closed `failed` — **PASS**
- runner returned `{kind:"unrouted", reason:"no-match"}` — the registered `misc-agent` (skill
  `some-other-skill`) was **not** routed to; no arbitrary agent ran: PASS.
- run terminal `failed`; seq-1 `agentId` stayed `null` (no agent recorded); checkpoint marked
  `agentUnrouted:true`; verify never ran: PASS.

### Claim 5 — G9 boundary (engine emits+blocks; runner runs the executor; engine never self-spawns) — **PASS**
- Code: `engine.ts` `runAwaitCallbackStep` (the `isAwaitCallback` branch, lines 300-302) runs the step
  handler (emit) and transitions the step/run to `blocked`. The engine module has **no executor concept**
  and never invokes an `AgentExecutor`. The executor is invoked **only** inside the runner's `runOnce`
  (`agent-runner.ts` line 245). The completer/agent_id recording is the runner's, in its own txn.
- Run log corroborates: the run reached `blocked` purely from `tick()` calls; seq-1 advanced to `done`
  **only after** the separate `agentRunner.runOnce()` invocation. The engine did not self-spawn the agent.

### Claim 7 — `npm run typecheck` clean — **PASS** (exit 0).

---

## #6 — Verifier-rigor finding (independent adversarial probe): **PASS — NOT a rubber-stamp**

Concern: is the T1 verifier `demo.agent-result-verifier` a trivial always-pass, or does it genuinely
read and discriminate on the agent's recorded result?

**Static reasoning:** the verifier (`demo-agent.ts:148-180`) re-reads seq-1's committed `result` +
`agent_id` from the DB scoped by `runId + AGENT_RESULT_SEQ`, and passes **only if both**
`result.producedBy === "demo-agent-sim"` **and** `agentId === "demo-agent"`. It is not derived from the
verify step's own state; it independently reads the recorded agent fact. The candidate the engine hands
it is the agent-result step's block-time checkpoint, which carries `runId` (engine.ts treats it as
opaque) — the verifier owns the read.

**Empirical proof** — the verifier (the SHIPPED function, black-box) was invoked directly against four
inputs (`examples/engine-demo-app/tests/verifier-rigor.probe.ts`, exit 0):

```
PROBE no runId in candidate                                  -> PASS (verdict=fail reasons=["no_run_ref_in_candidate"])
PROBE non-existent run (no agent-result row)                 -> PASS (verdict=fail reasons=["agent_result_step_missing"])
PROBE blocked agent-result, no agent ran                     -> PASS (verdict=fail reasons=["agent_result_marker_missing","agent_id_not_recorded"])
PROBE recorded marker + agent_id (positive control)          -> PASS (verdict=pass reasons=["agent_result_recorded","agent_id_resolved"])

VERIFIER-RIGOR PROBE: PASS — verifier discriminates (NOT a rubber-stamp)
```

The third probe is the decisive one: a run that **reached the blocked agent-result step but where NO
agent ran** (dispatch payload present, `agent_id` NULL) returns `fail` with both honest reasons. The
positive control (marker + `agent_id` recorded) is the only case that passes. **A run with no agent
result does NOT pass verify.** The verifier is genuine.

Corroborated by the live adversarial cases: in CASE 2 and CASE 3 seq-1 never carried a valid agent
result, the run went terminal `failed` **before** verify, and the verify step is observed `ready` (never
reached). The verifier had no opportunity to false-pass, and by the probe it would not have anyway.

---

## Bugs filed

None. No defect found; nothing required filing. (The probe surfaced no impl defect — only the probe's
own initial insert used wrong Drizzle field names, which is verifier-side and was corrected before the
empirical result above.)

---

## Honest limits / scope (carried forward, not defects)

- **Simulated executor only.** The proof exercises a deterministic in-process `AgentExecutor`. The real
  `claude -p` headless port and the production Admin runner are **S5, out of scope**. This proves the
  **chain mechanism off-prod** (engine emits+blocks → runner resolves+records → verify confirms), **not**
  a production agent run.
- `outcomeArrived` is wired to always return `false` (no app-side outcome store) — the
  callback-before-block race seam is present but the demo always blocks and lets the runner resolve.
- Verified on a single throwaway Postgres; concurrency-pool (N>1) behavior is engine-tested elsewhere,
  not re-exercised here (the demo drives `runOnce()` single-slot deterministically).

---

## Verdict: **VERIFIED**

All seven verification items pass on a clean checkout + fresh DB, re-run independently of the author's
log. Happy path GREEN; both adversarial paths fail-closed; G9 ownership boundary holds in code and at
runtime; typecheck clean; the T1 verifier is empirically proven to discriminate (not a rubber-stamp).
Scope limit (simulated executor; real port is S5) stated honestly.
