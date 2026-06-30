# ADR-005: Execution Engine + Heartbeat runtime is platform-owned and Execution-Node-hosted

- **Status:** PROPOSED — awaiting founder architectural approval (the runner is NOT registered until this is
  decided)
- **Date:** 2026-06-30 · **Deciders:** founder (architectural approval), builder (author)
- **Class:** Platform Boundary Decision (the *third* instance of the Platform Extraction pattern, after
  Governance and the Control Surface / ADR-004)
- **Scope guard:** this ADR **ratifies a boundary and a sequencing rule. It does NOT start the engine
  migration build** — that is a future roadmap milestone. Recording the decision honors "no new platform
  initiatives after ADR-004" (we are not building, we are deciding).

## Context
The founder flagged an inconsistency before provisioning Neo's runner. Verified facts:
- **delivery-os (the platform) has zero `.github/workflows/` and runs no app.** A self-hosted runner here
  would idle.
- **rumah-admin (a consumer) hosts every always-on workflow** that needs a runner — `heartbeat-driver.yml`,
  `dead-man-switch.yml`, `goal-supervisor.yml`, `scheduler-tiers.yml`, `migration-runner.yml`, `ci.yml` —
  and the **engine/heartbeat runtime runs in rumah-admin's Vercel deployment**.
- A GitHub self-hosted runner is bound to the repo whose workflows it executes. So registering Neo's runner
  against rumah-admin would make the **Execution Node serve a consumer's workflows directly**, inverting the
  ratified layering **Delivery OS → Execution Nodes → Consumers**.

This is the **same Platform Extraction pattern a third time**: a Delivery OS platform capability (the
**Execution Engine + Heartbeat *runtime***) is currently **hosted by a consumer**. PR #26 made the heartbeat
*capability/recipe* platform-owned (definition); the *running engine* (instantiation) still sits in
rumah-admin. In the correct model the node hosts the **platform** engine; consumers submit goals **to** the
platform; a consumer never gets its own runner on a node.

## Decision
1. **The Execution Engine + Heartbeat runtime is a Delivery OS platform capability** that must be
   **platform-owned and Execution-Node-hosted** — not embedded in a consumer.
2. **Neo's runner, heartbeat, and mesh provision against the platform-owned execution target, NOT against
   rumah-admin (or any consumer).** Registering a node runner against a consumer is forbidden — it is
   operational-theater that contradicts the layering.
3. **Until the runtime is platform-owned, Neo's runner/heartbeat/mesh remain DEFERRED.** Neo operates at its
   **platform-clean tier — workstation + localCI** (both verified, both consumer-free). That is the honest
   definition of "operational Execution Node 1" *today*; full 5/5 capability is gated on the runtime
   extraction.
4. **The migration is a roadmap milestone, not a now-build** (respects "no new initiatives after ADR-004").
   It is upstream of ADR-004 P3 (the Slack control surface deploys on the node and consumes the same goal
   API, so it inherits the platform-owned target).

## What "platform-owned execution" means (target, not built here)
A platform-owned execution home that an Execution Node hosts — the engine tick + scheduler + heartbeat as a
**Delivery OS deployment running on the node** (not a consumer's serverless cron). Consumers (rumah-admin,
PLOS, …) submit goals to it over the goal API and observe runs; they stop hosting the engine themselves.

## Migration phases (DEFERRED — roadmap, gated on founder go-ahead per phase)
- **M0 (this ADR):** ratify the boundary + the "no runner on a consumer" rule. No build.
- **M1:** define the platform-owned execution deployment (where the engine/heartbeat run as a platform
  artifact hostable on an Execution Node). Decision/spec.
- **M2:** relocate the engine tick + scheduler tiers (`*/5` heartbeat, dead-man-switch, supervisor) from
  rumah-admin's workflows/Vercel to the platform-owned target on the node.
- **M3:** re-point consumers to submit goals to the platform target; retire the consumer-hosted engine
  cron.
- **M4:** register Neo's runner + heartbeat against the platform target; `verify-node.sh --require
  runner,heartbeat`.
- **Sequencing:** M1–M4 slot into the roadmap; none of them runs in this session unless the founder elects
  the temporary bridge (see Alternatives).

## Verification criteria
- delivery-os (or the platform execution deployment) is the runner's registration target — **never a
  consumer repo**.
- After M2, the `*/5` heartbeat ticks from the platform target on the node; rumah-admin no longer hosts the
  engine cron.
- `verify-node.sh --require runner,heartbeat` passes only when the target is platform-owned.

## Rollback
- This ADR is a decision; rollback = supersede it with a new ADR.
- The deferral is inherently safe: nothing is provisioned against a consumer, so there is nothing to unwind.
  Neo's verified tier (workstation + localCI) is unaffected.

## Consequences
- **Positive:** the layering holds (node serves the platform, not a consumer); resolves the inconsistency
  before it is baked in; aligns with PR #26 and ADR-004; gives an honest definition of node operability.
- **Trade-offs:** Neo is **2/5 capabilities today**, not 5/5 — full operability is gated on the runtime
  extraction. The exhausted-Actions-minutes pain is **not** relieved this session (the temporary bridge is
  explicitly declined for correctness).
- **Follow-ups/risks:** schedule M1–M4 on the roadmap; until then the consumer keeps hosting the engine
  (status quo, no regression).

## Alternatives considered
- **Provision now against rumah-admin (temporary bridge):** rejected as the default — it inverts the
  layering we just ratified. *Available on explicit founder election* to relieve the minutes pain
  immediately, clearly labelled temporary, with M1–M4 still owed.
- **Migrate first, in this session:** rejected — it is a new initiative mid-stream and conflicts with "no
  new initiatives after ADR-004" + "don't delay"; the migration is non-trivial (the engine is the
  goal-governance loop, currently SHADOW).
- **Register the runner against delivery-os now:** rejected — delivery-os has no workflows; the runner would
  idle, delivering nothing.

---
*ADRs are immutable once accepted. Cross-project effects (rumah-admin stops hosting the engine) to be
reflected by an ECR when M2 is scheduled.*
