# ADR-005: Execution Engine + Heartbeat + Runner are Delivery OS platform capabilities (the third Platform Extraction)

- **Status:** ACCEPTED — 2026-06-30 (founder-approved, with the sequencing adjustment below: implementation
  is the **next platform milestone in the existing roadmap**, not a deferred document and not a separate
  initiative)
- **Date:** 2026-06-30 · **Deciders:** founder (architectural approval), builder (author)
- **Class:** Platform Boundary Decision — **the third Platform Extraction**, following **Governance**
  (extracted from rumah-admin) and the **Control Surface** (ADR-004).

## Context
Verified before provisioning Neo's runner: **delivery-os (the platform) has no `.github/workflows/` and runs
no app**, while **rumah-admin (a consumer) hosts every always-on workflow** (`heartbeat-driver`,
`dead-man-switch`, `goal-supervisor`, `scheduler-tiers`, `migration-runner`, `ci`) **and the engine/heartbeat
runtime** (Vercel deployment). A GitHub self-hosted runner binds to the repo whose workflows it runs — so
registering Neo's runner against rumah-admin would make the **Execution Node serve a consumer**, inverting
the ratified layering. PR #26 made the heartbeat *capability/recipe* platform-owned; the *running engine*
(instantiation) still sits in a consumer. The `/goal` front door being built in **Sprint 5.3** is this same
platform goal-API boundary, currently accreting inside the consumer.

## Decision (the four explicit statements)
1. **This is the third Platform Extraction**, following **Governance** and the **Control Surface (ADR-004)** —
   the same pattern: a Delivery OS platform capability is recovered from a consumer.
2. **The Execution Engine, the Heartbeat Runtime, and runner ownership become Delivery OS platform
   capabilities** — owned and provisioned by the platform, instantiated on Execution Nodes.
3. **Neo remains Execution Node 1 that *executes the platform*** — it hosts platform execution; it is not the
   platform and is not bound to any consumer.
4. **Consumers never own platform execution.** rumah-admin (and every consumer) submits goals to, and observes
   runs on, the platform engine — they do not host it, and no node runner registers against a consumer.

## Sequencing (the founder's adjustment — this is NOT deferred)
- The **implementation of this extraction is the NEXT Delivery OS platform milestone within the existing
  roadmap.** It is **not a separate initiative** and is **not indefinitely deferred**.
- It is **scheduled ahead of the work that depends on it** — specifically before **Sprint 5.3 (goal-intake
  C1 / the `/goal` front door)** and before un-SHADOWing the consumer-hosted goal-governance loop, since
  those depend on the platform-owned execution target existing.
- After it lands, **the roadmap continues in order.**
- **No temporary architectural compromises** (e.g. provisioning Neo's runner against rumah-admin for
  short-term functionality) **unless the founder explicitly approves them.**

## Milestone phases (scheduled, in roadmap order — gated by founder go-ahead per phase, not deferred)
- **M1 — Define the platform-owned execution home:** where the Execution Engine + Heartbeat + scheduler run
  as a **Delivery OS platform artifact hostable on an Execution Node** (spec + the structural seam). This is
  also the correct home for Sprint 5.3's goal-intake C1.
- **M2 — Relocate the runtime:** move the engine tick + scheduler tiers (`*/5` heartbeat, dead-man-switch,
  supervisor) from rumah-admin's workflows/Vercel onto the platform-owned target on the node.
- **M3 — Re-point consumers:** consumers submit goals to the platform target; retire the consumer-hosted
  engine cron.
- **M4 — Provision Neo against the platform target:** register the runner + heartbeat against the
  platform-owned execution home (never a consumer); `verify-node.sh --require runner,heartbeat`.
- Only after M1–M4: Neo reaches 5/5 node-contract capabilities, and Sprint 5.3 goal-intake lands on the
  platform target.

## Verification criteria
- The runner's registration target is the platform execution home — **never a consumer repo**.
- After M2, the `*/5` heartbeat ticks from the platform target on the node; rumah-admin no longer hosts the
  engine cron.
- `verify-node.sh --require runner,heartbeat` passes only when the target is platform-owned.
- Sprint 5.3 goal-intake C1 is built against the platform goal-API, not added to the consumer.

## Rollback
- This ADR is a decision; rollback = a superseding ADR.
- Per-phase: each milestone is independently revertible (M2 relocation can roll back to the consumer-hosted
  engine if needed); nothing is provisioned against a consumer, so there is no consumer-coupling to unwind.

## Consequences
- **Positive:** the layering holds (node executes the platform, consumers never own execution); the
  inconsistency is fixed *by implementation*, not parked in a document; PR #26 + ADR-004 + ADR-005 form a
  coherent platform-extraction arc; Sprint 5.3 lands in the right home.
- **Trade-offs:** Neo is **2/5 capabilities until M4**; the exhausted-Actions-minutes relief waits for the
  extraction rather than a consumer-bound shortcut (founder's explicit choice: correctness over speed, no
  temporary compromise).
- **Follow-ups:** update the Delivery OS roadmap immediately to schedule M1–M4 ahead of dependents; an ECR
  reflects the cross-project effect (rumah-admin stops hosting the engine) when M2 is scheduled.

## Alternatives considered
- **Provision Neo's runner against rumah-admin (temporary bridge):** **rejected by the founder** — it
  inverts the layering and is a temporary compromise; not to be used unless the founder explicitly approves.
- **Leave ADR-005 as a deferred document:** **rejected by the founder** — the extraction must be implemented
  as the next roadmap milestone, not parked.
- **Migrate as a separate one-off initiative:** rejected — it is part of the existing Delivery OS roadmap,
  sequenced ahead of its dependents.

---
*ADRs are immutable once accepted. Cross-project effect (rumah-admin stops hosting the engine) to be recorded
as an ECR when M2 is scheduled.*
