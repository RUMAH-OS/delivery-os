---
name: contract-grounding
version: 1.0.0
stability: stable
description: >
  Read-canonical-first gate (v5): before building any CROSS-SYSTEM producer or consumer surface, read the
  canonical contract + the consumer's actual code + the source of truth, and record the shape you are building
  to — BEFORE the first build edit. A contract existing is not a contract read. Invoke before any cross-system
  build slice (an API/event/projection a peer consumes, or a consumer of a peer's surface).
decision_class: integration
inputs:  [the canonical contract/decision record (read-only), the CONSUMER's actual code (read-only), the source of truth/system-of-record]
outputs: [a grounding note in the slice/VERIFY: the exact shape (envelope/fields/transport/auth) being built to + the consumer's real expectations + any divergence surfaced for ratification]
earned_from: "N18 (Company-OS phase): a cross-system producer was built from a MODEL of a contract that sat ratified on disk the whole time -> a transport built opposite to the ratified one, a divergent envelope, and a duplicate contract doc; plus a silently-drifted consumer contract and a producer-ranks-for-the-consumer misstep. Reading the consumer first caught the third before code; not reading the canonical caused the first. Continues the June dual-contract incident (F4)."
mechanical_spine: "Governance §15 read-canonical-first (THE canonical home for the rule); the OPERATING-LOOP 'Ground' step (cross-system slices); the DoD cross-system row. Hook DEFERRED until an observed skip earns it (the §12/§13 pattern) — policy now, not scaffolded mechanism."
---
# Contract Grounding (read-canonical-first)

## Overview
*Contracts + probes, never narrative claims* (Governance §15) says cross-system state travels as contracts, not
prose. This skill adds the missing clause earned by N18: **the contract must be READ, not modeled.** A frozen
contract that exists but is unread is functionally a prose claim — every cross-system defect in the recorded set
traced to building against a mental model of a contract sitting ratified on disk. This is distinct from
[[cross-system-reality-audit]] (which audits a peer's *current state* for a planning gate) and pairs with
[[executable-contracts]]: audit-before-assume covers *state*; contract-grounding covers the *contract + the
consumer's real code* before you build the surface.

## When to use
Before building ANY cross-system surface: a producer (an API / event / projection a peer consumes) OR a consumer
of a peer's surface. Not required for a project's own internal slice (the §12 non-impl exemption analogue — scope
is *cross-system*, not every slice).

## Procedure
1. **Read the canonical contract/decision record** that governs the surface (the ECR/ADR/contract doc) — its
   actual bytes, not your memory of it. If two contracts exist for the same seam, that is the dual-contract
   failure mode (June incident) — stop and reconcile to one canonical before building.
2. **Read the consumer's actual code** — what shape does it really parse/expect? (A drifted consumer contract is
   only visible in the consumer's code, not its doc — N18.)
3. **Read the source of truth** for the data (who owns it; what it actually contains).
4. **Record the grounding note** in the slice/VERIFY: the exact shape you will build to (envelope/fields/
   transport/auth) + the consumer's real expectations + the SoT. 
5. **Surface any divergence for ratification** (§11) — never silently build the producer's own interpretation, and
   never freeze a cross-system contract unilaterally (the human merge gate decides). Then, and only then, build.

## Success criteria (runtime-verifiable)
- A grounding note exists in the slice/VERIFY before the first build edit · it cites the canonical contract read
  (not relayed prose) · it cites the consumer's actual code · any divergence is surfaced, not smoothed.

## Honest failure
If the canonical contract cannot be located or two contradictory ones exist, **say so and stop** — building
against an unread or contested contract is the exact N18 failure. A grounding note that cites a doc you did not
actually open is theatre; the point is the read, not the note.

## Boundary-first (companion doctrine, Governance §15)
The producer (system of record) owns FACTS; the consumer owns ranking, attention, presentation, and action. Write
that ownership boundary before building across it, and judge cross-system work by one lens: **"does this help the
consumer understand and operate?"** (N22 — the boundary arrived as three founder corrections because it was never
written first.)

## Changelog
- 1.0.0 — earned from N18 (read-canonical-first / contract-grounding, the v5 keystone) + N22 (boundary-first);
  the callable form of Governance §15 *read-canonical-first*. Ratified in the v5 batch
  (`docs/DECISION-REVIEW-2026-06-13-delivery-os-v5-batch.md`).
