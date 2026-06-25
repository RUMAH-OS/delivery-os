# Agents in Delivery OS v6 — parallel system or native? End-state architecture, migration, risks, plan (2026-06-24)

> Founder concern: we fixed the agent *catalog* (made roles spawnable) but may not have integrated agents into v6.
> Investigated by 4 parallel specialists (capability model · routing/dispatch · engine execution · verification+learning).
> This is the consolidation: the verdict, the gaps, the end-state, and the migration.

## VERDICT: agents are a PARALLEL system. The catalog fix did not integrate them into v6.
Three independent investigations converge: catalog agents (`.claude/agents/*.md`) are **harness-spawned by the main
loop, governed by an authored-but-INERT track, absent from the capability registry, not engine-executable, not
verified by the engine, and not in the learning loop.** My prior catalog fix operated at the *harness* layer only.

**Critical disambiguation — "agent" means two unrelated things in v6:**
| | **Catalog/role agent** (`.claude/agents/*.md`) | **Engine executor-port agent** (`agent-registry.ts`) |
|---|---|---|
| What | a Markdown prompt role (qa-test, software-engineer…) | `{id, skills, executor}` — an injected function |
| Spawned by | the **harness Task tool / main Claude loop** | the engine's `agent-runner` drains an `agent-result` step → calls the executor (proven impl = `claude -p`) |
| In v6 engine? | **No** — engine never reads them; G9 forbids self-spawn | **Yes, natively** (verified via `engine.verify`) — but **dormant in prod** |
| Verified/recorded? | No (only author≠verifier *process*; `agent-health` is report-only) | **Yes** — the executor result is the verifier's candidate; verdict stored on the step |
They **share a word, nothing else.** The v6 verify/learning machinery that works lands on the *executor-port* agent, not the role.

## WHY agents aren't first-class (the gaps, evidence-cited)
1. **Model gap (by design):** the v6 *capability* manifest has **no slot for an agent** — `invoke.kind ∈ {cli,http,event,none}`, facets are contract/events/ui/skill/wiki. An agent is neither a kind nor a facet. The spec intends agents as a **distinct primitive**, not a capability (`CAPABILITY-MANIFEST-STANDARD.md`, `DELIVERY-OS-EXECUTION-MODEL-V1.md §2`). `capability-health` reads `tools+skills` only → blind to agents (`capability-health.mjs:106-110`).
2. **The whole routing layer is built but STARVED — and worse, the gate that would feed it was never built:**
   - `agent-frontmatter.mjs` *requires* `kind:"agent"` + `capabilities[]` + `triggers[]`; `agent-route.mjs` ranks by them; `dispatch-route.mjs` composes them. But **zero agent files carry that frontmatter** → the router scores every agent ~0 → running `agent-route` on the real roster prints *"no agent matched."*
   - **Correction to the obvious premise:** it is NOT "skills carry it, agents don't." **Both are starved** — only **3 of ~21 skills** carry the v6 frontmatter; the *reference* skill `verify-gate` does **not**; `skill-route` on the installed roster also returns *"no skill matched."* Agents are the worst case (0 coverage), not the sole one.
   - **The `agents:check` gate is PHANTOM.** It's referenced in comments and `V6-COMPLETION-BACKLOG.md` claims it **`✅` done** (G6) — but on disk there is **no script, no caller of `validateAgentFrontmatter`, no CI wiring**. A backlog-says-done / disk-says-absent **§12 author≠verifier drift** (the verifier-of-record never ran). So nothing forces the frontmatter to exist or stay correct — which is exactly how it rotted to zero while the doc reads `✅`.
3. **No engine path to catalog agents (G9 ceiling):** the engine **never spawns** — *"only the main loop (Claude) spawns subagents; dispatch-route plans, it does not spawn"* (`G9-DISPATCH-RUNNER-ARCHITECTURE.md:12-17`). Triggers reach the engine only by enqueueing **workflows**. The executor-port bridge (`agent-runner`) is built + proof-verified but **dormant in prod** (no runner started; `/v1/agent-results` still uses `system-callback`; `agent-result` "reserved for a FUTURE enhancement").
4. **No outcome accounting/learning for roles:** `agent-health` classifies each spawn DECISIVE/IDLE but is **report-only (stderr), never persisted, never gates, never feeds the ledger.** `learning-review` keys on *lessons*, tracking agents at the *governance* altitude (exists? used?), never the *outcome* altitude (did it catch what it owned?). The anti-decay rule exists; **nothing runs it.** The knowledge layer has **no Agent type** — agents *consume* knowledge, they aren't units in it.

## Should agents be discoverable through the CAPABILITY registry? — No; through their OWN registry — Yes.
The spec is deliberate: agents are a **distinct primitive**, not a capability (a capability is *what can be invoked*; an agent is *who owns the outcome*). So **do not force agents into `*.capability.json`.** Instead, **activate the agent's own discovery spine** (the authored-but-inert `agent-frontmatter` contract + `agent-route` + a real agent registry) and make it a *peer* of the skill/capability registries under one dispatch layer.

## END-STATE ARCHITECTURE — how workflows · capabilities · triggers · agents · verification · learning connect
```
 TRIGGER (business event / time / mailbox)
    │  enqueue(definitionKey, input, idem)           ← live today (dunning sweep)
    ▼
 WORKFLOW (engine) ── steps ──▶ some steps are CAPABILITY calls (cli/http/event)
    │                          some steps are AGENT steps (await_source='agent-result',
    │                                                       agent:{capabilities/skill})
    │  the engine EMITS an agent-task + BLOCKS (never spawns — G9)
    ▼
 DISPATCH ── agent-route ranks AGENTS by capabilities[]/triggers[] (deterministic, logged)
    │        injects routed SKILLS + KNOWLEDGE into the spawn prompt (knowledge-route)
    ▼
 SPAWNER (the bounded runner / main loop — the ONLY thing that may spawn, G9)
    │  runs the selected catalog AGENT as the executor (claude -p or main-loop subagent)
    ▼  posts the result back as the agent-result
 ENGINE.VERIFY (T1–T5, eval-the-evaluator) judges the agent's output = the candidate
    │  pass → stop · fail → Improve retry · cap/irreversible → HUMAN gate (approval)
    ▼
 OUTCOME RECORD (persisted: which agent, routed-why, verdict, decisive?)
    ▼
 LEARNING (learning-review → capability ledger): anti-decay — agent that missed X →
    strengthen; agent IDLE N milestones → retire. Feeds back into routing + the roster.
```
**The unifying move:** make the **catalog role the *executor* of an engine `agent-result` step**, routed deterministically by its `capabilities/triggers`, its output **verified by `engine.verify`**, its outcome **recorded** and **learned-from** — while the **main loop remains the only spawner** (G9). Then a trigger can natively reach an agent (trigger→workflow→agent-step→routed role→verified→recorded→learned), and agents become first-class without being mis-modeled as capabilities.

## MIGRATION PATH (sequenced; each a slice via engineer→QA→reviewer)
- **P1 — Frontmatter + gate as ONE PAIRED change (keystone):** author `kind:"agent"` + `capabilities[]` + `triggers[]` on all 16 agents **AND** build+wire the `agents:check` gate (`validateAgentFrontmatter` over `.claude/agents/*.md`, fail-closed, in pre-push/CI) **in the same change.** *Order matters and is a trap:* a gate flipped on before the roster is populated blocks every push; a roster populated without the gate silently rots (how it reached zero while the backlog reads `✅`). Additive + safe for the harness (it ignores the fields). Apply the same gate honestly to skills (verify-gate + ~18 others fail it today). *This is what my catalog fix omitted.*
- **P2 — Route real work through dispatch (and fix the taxonomy).** Dispatch is **orthogonal layers, not a primitive-picker**: one dispatch resolves the **owner agent** (`agent-route` advisory, **G14 ownership-policy WINS** — `dispatch-route.mjs:206`) and **injects** the top-1 skill + top-1 knowledge into the spawn prompt. Route real work through it (evidence-logged). **Extend `ownership-policy.json` to add `verify`/`review`/`cleanup` work-types** — today only *build* dispatches (coverage ~0.19), so even a full roster routes ~50% of slice work.
- **P3 — Persist the agent-outcome record** — make `agent-health`'s per-spawn DECISIVE/IDLE classification a **durable artifact** (a log/ledger), not stderr; surface IDLE/never-chosen.
- **P4 — Wire the anti-decay learning loop** — an executed pass: agent missed defect → strengthen row; agent IDLE N milestones → retire candidate (the rule exists; run it).
- **P5 — Activate the engine executor-port bridge in prod** (separate from catalog work): start a bounded `agent-runner`; make the engine honor `await_source='agent-result'` on real blocks; add a real `agent-result` workflow definition. *Respect G9 — the runner/main-loop spawns; the engine emits the task.*
- **P6 — Bind catalog roles as engine executors** — register selected catalog agents as engine agents whose executor spawns the role (via the bounded runner) so their results pass through `engine.verify`. This is the unification.
- **P7 — Decide the registry boundary** (founder call): keep agents OUT of `*.capability.json` (distinct primitive) but give them a **first-class agent registry** that `dispatch-route` and `capability-health`-style measurement both consult.

## RISKS
- **G9 no-self-spawn ceiling (hard invariant):** the engine must never spawn catalog agents autonomously. The executor bridge must route through the bounded runner / main loop. Violating this breaks the platform's safety model. *Design P5/P6 around it, don't around it.*
- **Turning on `agents:check` fail-closed** before P1 lands would reject the entire roster. Sequence: apply frontmatter to ALL agents first, THEN enforce.
- **Calibration:** catalog-agent outcomes judged by `engine.verify` need *calibrated* verifiers (eval-the-evaluator) before any verdict may GATE — else advise-only/fail-closed to a human.
- **Two-concept confusion:** name them distinctly (role-agent vs executor-agent) or the migration will conflate them again.
- **Frontmatter authoring quality:** `capabilities[]`/`triggers[]` must be accurate or routing mis-selects — needs review (reviewer-critic) per agent.
- **Scope/drift:** this touches the framework's enforcement-adjacent machinery (router, gate) — go through delivery-os's own gate + a §11 panel for the registry-boundary decision (P7).
- **Documentation says done, disk says no (§12 drift):** `V6-COMPLETION-BACKLOG.md` marks `agents:check ✅` + `route:suite` done; neither exists on disk. **Do not trust the backlog's `✅` — re-verify each "done" claim against disk before building on it.** This is itself a finding: the agent-routing layer was marked complete without the verifier-of-record ever running.

## IMPLEMENTATION PLAN (smallest valuable first)
1. **P1 (keystone, ~2–3d):** author `kind/capabilities/triggers` for the 16 canonical agents (from each agent's description + this session's lived routing signals) **and build `agents:check`** in the same change. Verify: `agent-route` ranks correctly on sample tasks; `agents:check` validates the whole roster + fails-closed on a planted bad agent; harness spawn unaffected; `capability-health` flips `agent-route`/`agent-frontmatter` MISSING→ALIVE.
2. **P3 + P4 (~2–3d):** persist agent-health outcomes to a durable ledger; run the anti-decay pass in `learning-review`. Verify: an IDLE agent surfaces; a "missed-X" produces a strengthen row.
3. **P2 (~2d):** route a real task category (e.g. verification fan-out) through `agent-route`; record selection rationale. Verify: selection is evidence-logged, not model-asserted.
4. **P5 (~3–5d, parallel track):** activate the engine agent-runner in a consumer (Admin) for one real `agent-result` workflow; honor the await source. Verify: a workflow agent-step completes through the runner + `engine.verify`, recorded.
5. **P6 (~3d):** bind one catalog role as an engine executor; its output passes `engine.verify`. Verify: trigger→workflow→role→verified→recorded end-to-end (off-prod).
6. **P7 (founder §11):** ratify the registry boundary (agents distinct from capabilities, with their own first-class registry).

## Bottom line for the founder
**You are right.** The catalog fix made roles *spawnable* (harness layer); it did **not** make them v6-native. Agents today are a parallel primitive whose own discovery/verify/learning spine is **authored but inert**, and whose engine bridge is **dormant**. The end-state is achievable without mis-modeling agents as capabilities: **activate their frontmatter contract (P1), route+measure+learn (P2–P4), and bridge selected roles into the engine's verified executor-port path (P5–P6) — with the main loop as the only spawner (G9).** The keystone, and the smallest first step, is **P1: give the 16 canonical agents their `capabilities/triggers` frontmatter** — that single slice flips the agent-router from inert to functional.

## Honest limit
- Synthesized from all 4 specialist reports + direct orientation reads (capability model · routing/dispatch · engine execution · verification+learning), each evidence-cited.
- The registry-boundary (P7) is a consequential framework decision → founder/§11, not an agent call.
- Several v6 "done" claims (`agents:check`, `route:suite`) are contradicted by disk — treat the backlog as unverified until each is re-checked.
