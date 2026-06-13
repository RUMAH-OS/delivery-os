# Delivery OS v5 → PLOS adoption evaluation (which improvements flow first)

> Founder ask (2026-06-13): after minting v5.0, evaluate which v5 improvements should flow into PLOS first —
> especially Read-Canonical-First (A4), Boundary-First, Runtime-Reproduction, Token-Cost Visibility.
> **This is an evaluation/recommendation only.** Delivery OS is the parent; PLOS inherits **by pin** at a named
> moment, executed by the PLOS session — I do not edit PLOS (I read it to ground this). Standard: *does it help
> build/evolve The Room/Admin/Workspace/Company-OS faster, safer, with less founder effort?*
> PLOS context (from the read-only investigation): PLOS is THE consumer of Admin truth (events seam + read seam),
> builds The Room / Advisor / Inbox, owns ranking/attention/presentation, runs always-on workers (ECR-0005), and
> already hit the consumer-contract-drift class (N18) at the Admin↔PLOS seam.

## Priority order + per-improvement leverage for PLOS

### 1. Read-Canonical-First / contract-grounding (A4) — **HIGHEST leverage; adopt first**
- **Why PLOS most:** PLOS is the consumer that builds *against Admin's contracts* (events `/v1/events`, read seam
  `/v1/ops`,`/v1/finance`). The exact N18 failures — a consumer contract drifted from what Admin emits; a producer
  built opposite to the ratified transport — live on this seam. A4 directly prevents the most expensive class PLOS
  faces.
- **How PLOS adopts:** pin `os_version: v5.0`; apply the `contract-grounding` skill + the OPERATING-LOOP **Ground**
  step to every Admin-consuming slice — before building a consumer, read Admin's *canonical* contract (ECR-0006 §A
  + the read-seam contracts) AND Admin's *actually-emitted shape* (drive the live endpoint), record the shape, then
  build. (PLOS's own consumer-contract doc had drifted from Admin's §A — A4 is the gate that catches that.)
- **Watch:** A4 is policy (hook deferred) — so it depends on the PLOS session actually running the Ground step;
  pair it with the existing `cross-system-reality-audit` (state) for full coverage (contract + state).
- **Expected benefit:** eliminates Admin↔PLOS rework round-trips; less founder mediation of cross-repo drift.

### 2. Boundary-First — **HIGH; adopt with A4 (same seam, same slice type)**
- **Why PLOS most:** the Admin=facts / The-Room=ranking-attention boundary IS the PLOS boundary. The three N22
  corrections (producer-owns-facts, don't-edit-the-sibling, don't-build-what-the-consumer-replaces) were Admin↔PLOS
  corrections. PLOS owns ranking/attention/render; it must NOT ask Admin to rank, and must write the boundary before
  building The Room/Advisor consumers.
- **How PLOS adopts:** the §15 boundary-first doctrine + the one-line lens *"does this help the founder (via The
  Room) understand and operate?"* applied to every cross-system surface; folded into `contract-grounding`.
- **Expected benefit:** prevents the "who owns what" churn; keeps The Room as the source of understanding without
  re-deriving Admin facts.

### 3. Runtime-Reproduction + checked-in guard (REPRO) — **MEDIUM-HIGH; adopt when PLOS ships runtime consumers**
- **Why PLOS:** PLOS runs always-on workers (the future poller/consumer of Admin events, BullMQ). Runtime bugs
  there (concurrency, queue, poller cursor) are the N17 class — reproduce on the running thing under realistic load,
  leave a guard.
- **How PLOS adopts:** the §15 runtime-repro doctrine + (when the skill bumps land) the deploy/cutover skill
  updates, applied at PLOS's runtime/worker slices — not before PLOS has a running consumer to reproduce against.
- **Expected benefit:** prevents assumption-fixes on PLOS's runtime (the pooler-saga class); a guard per consumer.

### 4. Token-Cost Visibility (A3) — **MEDIUM; adopt when the instrument lands (Phase-1)**
- **Why PLOS:** PLOS runs LLM agents (the Advisor, scoring-adjacent reasoning) — LLM spend is real there, so
  per-role/per-slice cost visibility has clear value for the Advisor's practical-tier reasoning loop.
- **How PLOS adopts:** after the v5 Phase-1 A3 instrument exists (read-only telemetry), PLOS registers its
  agent/worker costs in the same cadence. **Guardrail carries:** cost is never a gate/DoD/verify-status input —
  "cheaper" must not become "skip the D2 human-approval or the eval gate" in PLOS.
- **Expected benefit:** visibility into the Advisor/worker spend; steers effort, never verification.

## Recommended sequencing for PLOS
**Pin v5.0 → adopt A4 + Boundary-First immediately** (doctrine + the contract-grounding skill; highest leverage,
both apply to the Admin-consumption slices PLOS is about to build — the poller/consumer, The Room's truth feeds,
the Advisor's fact pack). **Then REPRO at PLOS's first runtime/worker slice. Then A3 once the Phase-1 instrument
lands.** A2 (risk-scaled verification) + A6 (test hygiene) flow in too via the pin, but the four named above are
the highest-leverage for the Company-OS effort.

## Mechanics (the PLOS session executes; not done from here)
- PLOS pins `os_version: v5.0` in `.claude/.verify-config.json` at a named moment + runs `os-sync` (its pin is
  currently behind — the repeated `consumer stamped at os_version=v3.8…may be BEHIND` warning).
- A4/Boundary are inherited as doctrine + the `contract-grounding` skill at that pin.
- **The boundary holds:** Delivery OS (parent) → PLOS (consumer) by pin; PLOS never flows up into Delivery OS
  except via the §14 promotion loop. This doc recommends; the PLOS session + founder coordinate the adoption.
