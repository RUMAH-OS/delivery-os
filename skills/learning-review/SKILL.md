---
name: learning-review
version: 2.1.0
stability: stable
description: >
  Phase-end retrospective that converts experience into ROUTED changes: artifact-reconstructed
  assumptions/accelerators/bottlenecks analysis, pattern census, and implemented improvements — never a
  feelings document. Project-local findings implement in the same series; OS-base/cross-system findings go
  design-first through an OS-FEEDBACK triage (the blast-radius fork). Invoke at the end of any major phase
  (migration, launch, integration), after any significant failure, or via /learning-review. This is the
  default phase-end retro (founder ruling F8); multi-blind-lens reviews are reserved for OS-level/capstone questions.
decision_class: governance
inputs:  [the phase's commits, VERIFY docs (incl. FAIL sections), decision/gate ledgers, friction log, permission-refusal moments]
outputs: [docs/RETROSPECTIVE-<date>.md + same-series project-local changes + docs/feedback/OS-FEEDBACK-<event>.md for anything OS-level]
earned_from: "Consumer A's rebuild retrospective 2026-06-12 (produced 7 earned skills + kernel update in one series) — AND the same retro's own bypass: it applied implement-in-same-series to OS-LEVEL lessons, self-minting a version label with no triage (ruling C1). The fork below is that incident, mechanized. Sources tagged [A]/[P]."
mechanical_spine: "/learning-review command; the first-class hook's classifier `templates/tools/learning-trigger.mjs` decides the LEVEL (L0/L1/L2 — D10/ADR-003); §14 review-artifact detector hard-blocks pushing the retro without its triage; N-merges backstop caps learning debt at 30 (the never-run retro); on L2, `templates/tools/learning-classify.mjs` routes every approved lesson into the 10-way taxonomy + `templates/tools/founder-learning-package.mjs` emits the Founder Learning Package"
---
# Learning Review (v2.1 — first-class hook · 3-level trigger policy · blast-radius fork)

## The 3-level trigger policy (D10 / ADR-003 — registers this skill as a first-class lifecycle hook)
Learning Review is a first-class Delivery OS lifecycle hook, **peer to VERIFY and Founder Review**. The classifier
`templates/tools/learning-trigger.mjs` decides which level fires (eval is **FAIL-OPEN** — L0/L1 never block a push,
commit, or goal; review is **CLOSE-DEFAULT** — no review unless a trigger fires):
- **L0 — continuous capture** (every slice): append-only signal capture (`capabilities/signals.jsonl` via
  `file-lesson.mjs` + the gates). No review, no block.
- **L1 — lightweight checkpoint** (phase-end / routine boundary): a fast **bump-or-declare-no-learning** pass
  (step 7 below) — non-blocking.
- **L2 — full multi-specialist review** (HEAVY triggers only — **incident · ADR/board · new-capability ·
  founder-epic · milestone · census-candidate · the §14 N-merge backstop >30**): runs the full procedure below,
  **composing principle-11's multi-lens machinery into the retro** (a *scaled* panel — §11 economics intact, not
  14 blind lens-runs), then **auto-classifies** every approved lesson and emits the **Founder Learning Package**.

`learning_expected = (L1 ∨ L2)`; default no-review. The N-merge backstop (§14, default 30) is the completeness
guarantee — the recorded **175-overdue** retro becomes structurally impossible; rejecting **review-every-slice**
avoids the recorded **14×-fanout** over-fire. SHADOW rollout: classify + log before gating. This registration
**feeds the §14 promotion machinery — it does not relax the promotion bar (observed failure OR second consumer)
or the §11 panel economics.**

## Overview
A retrospective that changes nothing was a meeting [A]. But a retrospective that changes the OS *in the same
commit series* is a governance bypass [C1]. This skill does both halves correctly: implement project-local
learning immediately; route OS-level learning design-first.

## When to use (and NOT)
- Use when: a phase ends (migration, launch, integration), after any significant failure, or when the §14
  N-merges backstop fires.
- **NOT** for: consequential design decisions (→ `principle-11-review`); a single defect (→ `friction-triage`);
  OS-level/capstone questions about the operating system itself (→ multi-blind-lens review, F8).

## Process
1. **Reconstruct from artifacts, not memory** [A]: walk the commit log, VERIFY docs (including FAIL sections),
   the decision ledger, the gate ledger, the friction log, and permission-refusal moments. The failures the
   record preserved are the curriculum.
2. **Assumptions ledger** [A]: proven vs disproven, each with the concrete moment it was tested. An assumption
   never tested goes in as "still unverified" — never as "held".
3. **Accelerators vs drag** [A]: for each, name the ROOT CAUSE and the mechanism (not "communication was hard"
   but "state relayed as prose carried false claims; contracts+probes worked").
4. **Pattern census** [A]: workflows/verifications repeated ≥2 times, with counts. Each becomes → skill (if a
   playbook would execute it better next time) · → practice note (judgment, not procedure) · → tooling (code).
   Apply the harvest litmus (skills/README): recurred ≥2 + a named earning incident + a stable artifact shape.
5. **Do more / stop / simplify / standardize** [A] — each item actionable, none aspirational.
6. **IMPLEMENT — with the BLAST-RADIUS FORK (mandatory; ruling C1, founder ruling F8):**
   - **6a. Project-local lessons** (carry a project noun / only this project cares): implement **in the same
     commit series** — skills written (earned, not scaffolded), project docs amended, drift-lint green.
   - **6b. OS-base / cross-system lessons** (no-noun, every-project class, or touching a peer/the ecosystem):
     **DESIGN-FIRST** — file `docs/feedback/OS-FEEDBACK-<event>.md` (§14) and route through the promotion
     pipeline. **Never write the base, the ecosystem registries, or a version label from a retro series.**
     The earning incident: a retro shipped OS-level packaging *and minted an OS version label* in its own
     commit — exactly the bypass its own red-flag list warns about.
   - **6c. AUTO-CLASSIFY every approved lesson into the right asset (L2; D10/ADR-003).** Run
     `templates/tools/learning-classify.mjs` — each approved lesson routes into exactly one of the **10-way
     taxonomy** (*hook · template · doctrine-line · skill · agent-change · lint · process-adjustment ·
     capability-ledger-row · ADR/decision · no-framework-change*) and is inherited via
     `os-foundation.manifest.json`. **A lesson is never assumed a skill** — storing it in the wrong artifact is
     itself a defect (§14). The OS-base lessons from 6b carry their classified asset through the OS-FEEDBACK
     triage; this step makes the routing mechanical, not a guess.
   - **6d. Emit the Founder Learning Package (L2).** `templates/tools/founder-learning-package.mjs` produces the
     zero-tech founder-facing artifact — what was learned · what changed · what (if anything) the founder must
     decide — mirroring the Founder Review Package envelope (implementation detail hidden).
7. **Bump-or-declare-no-learning** [P]: every skill USED during the phase either bumps its version (+ changelog
   line) or records an explicit "no learning". Earned: every skill in three repos sat at 1.0.0 after the
   heaviest procedure month on record, while one skill's real procedure shadow-forked far past its file.
8. **Honesty bar** [A]: include the embarrassing items (wrong adapters, encoding bugs, false assumptions acted
   on). If the document reads well, it probably isn't honest enough.

## Red flags
- Lessons phrased as virtues ("we should communicate better") instead of mechanisms [A].
- Skills scaffolded for things done once [A].
- The review praising the process that the same review's evidence shows was bypassed [A — and that flag, as
  originally written, described its own step 6; hence the fork].
- An OS-level change or version label landing in the retro's own commit series (6b violation — the §14
  detector now hard-blocks the push).
- Claiming a process/packaging change "worked" before it has fired on real work — **a conversion is unproven
  until it fires** (N1: the cleanest conversion in the record was its repo's final commit; its benefit claim
  was a projection). Name the adoption moment that will test it.

## Verification (of this skill's own output)
- Every claim in the retro cites an artifact (commit, VERIFY, ledger row) — reconstruction, not recollection.
- Each 6a item has a same-series commit; each 6b item has an OS-FEEDBACK file in the same push (the §14
  detector enforces this mechanically).
- Each used skill shows a version bump or an explicit "no learning" line.

## Changelog
- 2.1.0 — **registered as a first-class lifecycle hook (peer to VERIFY + Founder Review), `DECISIONS.md` D10 /
  `docs/adr/ADR-003`.** Adds the **3-level trigger policy** (L0 continuous capture / L1 lightweight checkpoint /
  L2 full multi-specialist review on the heavy triggers), driven by the classifier
  `templates/tools/learning-trigger.mjs` (fail-open on L0/L1; close-default). L2 **composes principle-11's lens
  machinery into the retro** (scaled, §11 economics intact), **auto-classifies** every approved lesson via
  `templates/tools/learning-classify.mjs` (the 10-way taxonomy, steps 6c) and **emits the Founder Learning
  Package** via `templates/tools/founder-learning-package.mjs` (step 6d). Closes both recorded failures — the
  175-overdue under-fire (N-merge backstop is the completeness floor) and the 14×-fanout over-fire (reject
  review-every-slice). SHADOW rollout; the §14 promotion bar + close-default + no-backflow lint are UNCHANGED.
  Keeps the v2.0 blast-radius fork + bump-or-declare-no-learning.
- 2.0.0 — v4 union: consumer A's executable retro (artifact reconstruction, assumptions ledger, pattern
  census, implement-in-same-series, honesty bar) + the mandatory blast-radius fork (C1/N2, F8) +
  bump-or-declare-no-learning (B16) + the N1 unproven-until-fired doctrine.
