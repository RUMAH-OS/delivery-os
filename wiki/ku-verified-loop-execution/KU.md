---
kuId: ku-verified-loop-execution
title: Goal-oriented agent execution is a bounded, objective-stop, verifier-gated LOOP — not step-execution
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "Goal-oriented agent execution is Goal→Act→Verify→Improve→Stop, NOT step-execution. Every goal-oriented agent task is BOUNDED (a maxAttempts hard-cap, by construction) + gated by an OBJECTIVE stop condition + verified by a calibrated Verifier capability. The loop is a PATTERN — act + verify + a bounded branch composed over the existing P1–P4 primitives — NOT a new engine primitive; it adds no durable mechanism, only a bound and a stop-predicate. The VALUE is the verification + the objective done-criteria, NOT the step-execution; loops are OPT-IN where verification matters and single-shot steps remain the default. This is the runtime generalization of the org's own author≠verifier / verify-gate / §11 maker-checker dogfood, not an imported AI-workflow idea."
triggers:
  - "how should an agent know when to stop"
  - "what is the stop condition for this loop"
  - "is this goal-oriented execution or step execution"
  - "goal act verify improve stop"
  - "should this agent task be a loop"
  - "does this loop have a bound / maxAttempts"
  - "is the loop runaway / unbounded retry"
  - "objective stop condition"
  - "bounded iteration"
  - "retry until verified"
  - "verified loop execution"
topics:
  - verified-loop-execution
  - goal-act-verify-improve-stop
  - bounded-iteration-maxattempts
  - objective-stop-condition
  - loop-is-a-pattern-not-a-primitive
  - loops-are-opt-in-verification-matters
evidence-strength: runtime-evidenced
cited-quote: "make the org's OWN discipline a first-class RUNTIME pattern"
source-provenance:
  earned-from: "Founder directive — Loop Engineering / verified-loop execution ask (2026-06; founder-ratified as a core Delivery OS design principle), modelled in DELIVERY-OS-EXECUTION-MODEL-V1.md §10 (the verified-loop pattern), generalizing the org's own maker-checker dogfood (§10.0)"
  source-file: "../delivery-os/capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md"
  anchor: "§10 (lines 312–432): §10.0 own-DNA-generalized; §10.1(2)/§10.2 the three additions (maxAttempts hard-cap + objective stop-predicate + back-edge); §10.1(3) loop=PATTERN not primitive; §10.3 the honest hard part. Candidate-KU named in §10.5.6 (line 569)."
  git-sha: "ea56546"
  signal-pattern: null
  ratification-note: "Founder-ratified as a core design principle ('I consider verified-loop execution essential to the long-term Delivery OS vision and want it treated as a core design principle going forward'), BUT the source DELIVERY-OS-EXECUTION-MODEL-V1.md is DESIGN-ONLY (no build/wiring) — so this KU is held at runtime-evidenced (the principle is dogfooded at development-time, the runtime engine is not built). Promote to founder-ratified strength once the verified-loop pattern is built + one flow runs act→verify→bounded-branch to terminal. DRAFTED by knowledge-engineer; author≠verifier — NOT self-certified."
related:
  - ku-capability-governance-ladder
  - ku-enable-capabilities-on-trust-not-existence
  - ku-implemented-is-not-operationally-proven
  - ku-verify-seam-by-one-real-round-trip
tags: [execution-model, verified-loop, goal-oriented, bounded-iteration, stop-condition, verifier, author-not-equal-verifier, founder-os]
---

# Goal-oriented agent execution is a bounded, objective-stop, verifier-gated LOOP — not step-execution

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A goal-oriented agent task is not a sequence of prompted steps. It is a LOOP:

> Goal → Act → Verify → Improve → Stop

The founder's ask was to make the org's own discipline a first-class RUNTIME pattern:

> make the org's OWN discipline a first-class RUNTIME pattern

Every goal-oriented agent task is therefore **BOUNDED** (a `maxAttempts` hard-cap, enforced by construction —
a back-edge with no bound is a runaway), gated by an **OBJECTIVE stop condition** (a predicate evaluated over a
*verify* result, not a subjective "looks done"), and **verified by a calibrated Verifier capability** (see
`ku-verifier-must-be-evaluated`). The VALUE is the verification + the objective done-criteria — **not** the
step-execution.

**This is the org's OWN DNA, generalized — not a new concept.** Delivery OS already runs maker-checker verified
loops at the *development* level: every slice is build-agent → independent verifier → retry → stop-when-verified,
enforced by author≠verifier (CODEOWNERS), the `verify-gate` skill + hook, and the §11 multi-lens review for
consequential decisions. A slice counts as done only when an INDEPENDENT verifier reproduces its criteria — that
*is* a verified loop with an objective stop (the criteria) and a hard cap (the gate blocks; it does not retry
forever). This KU promotes that development-time discipline to a **runtime execution pattern** for agents. The
verification-DNA KUs are the development-time form; this is their runtime generalization — say so explicitly:
`ku-author-not-equal-verifier` / verify-gate / §11 become, at runtime, *Act → independent Verify → bounded
retry → stop-when-verified*.

**The loop is a PATTERN, not a new primitive (the over-build guard).** The loop is pure COMPOSITION over the
existing primitives: an **act** step (P2 in-process or P3 await) + a named **verify** step (P3 agent-result or
a P2 in-process check) + a **bounded branch** (P4 next-selector + a `maxAttempts` field + a stop-predicate). It
introduces **no new durable mechanism**, so it is not a primitive (there is no P5). The only engine surface is
two tiny fields on a looping step — `attempt`/`maxAttempts` and a `stopCondition` predicate P4 evaluates — the
same order of magnitude as the timer-wake `wake_at` net-new. Calling the loop a primitive would re-absorb
verification + decision content into the engine, the exact anti-pattern the over-build guard forbids:
**loop = composition; verifier = capability; bound + predicate = the only engine surface.**

**Why (the non-obvious reason).** The feared failure is precisely *build a step-executor, later discover the
value was verification + stop + bound, and retrofit them.* A step-executor that *can* cycle (the state machine
already permits a back-edge) is NOT a first-class verified loop: with no GOAL/objective-stop concept, no attempt
counter, and no NAMED verify step, a back-edge is just a runaway and verification is indistinguishable from
action. Making goal + verify + stop + bound first-class NOW — at near-zero extra engine surface — is what avoids
the retrofit *without* over-building a loop primitive. And the discipline is what makes "the agent finished" mean
something: an unbounded loop burns cost forever; a loop with a subjective stop stops on a vibe; a loop without a
verifier confidently iterates toward a wrong objective (the failure mode `ku-verifier-must-be-evaluated` exists
to prevent). The mechanics are trivial and cheap (a back-edge + a counter + a predicate, near-proven); the real
work is the verifier quality and the objective done-criteria — do not loop a step whose success you cannot
objectively check.

**Loops are OPT-IN.** Most tasks do not need loops. Single-shot steps remain the default; you add a verify step
+ a bounded branch *only* around the steps where verification actually matters (e.g. classification confidence,
draft quality). The engine stays minimal on purpose.

**How to apply (domain-stripped, reusable).**
1. **State a GOAL with objective success criteria, not a step list.** Before looping, write the done-criteria as
   a predicate a verifier can evaluate (a deterministic rule, a threshold, a checker verdict) — not "looks good."
   If you cannot state an objective stop, do not loop the step (single-shot it, or human-gate it).
2. **Bound every loop by construction.** Carry `maxAttempts` on the looping step; the bound is enforced by the
   tick, not by reviewer memory. No bound → it is a runaway, not a loop.
3. **Name the verify step distinctly from the act step.** Act produces a candidate; a separate, named Verify step
   produces the verdict. Verification must be visibly its own step, gated by a calibrated Verifier
   (`ku-verifier-must-be-evaluated`), never folded into the action.
4. **Branch on the verify verdict; stop on the objective predicate.** `pass` → stop; `needs_improvement` →
   bounded retry (the back-edge, feeding `suggestedImprovement` back to act); `fail`/`attempt ≥ maxAttempts` →
   route to a human-approval await (the unbypassable floor), never to silent failure or unbounded retry.
5. **Emit every attempt + every verify result.** Per-attempt observability (goal, attempts-so-far, last verdict,
   stop-reason) is emitted via the existing transport — no new mechanism — so the run is re-findable and the
   North-Star screen reads it directly.

**The test for any "the agent finished" claim.** Ask: *"what was the GOAL, what OBJECTIVE predicate stopped the
loop, was the loop BOUNDED by a maxAttempts hard-cap, and was the stop verdict produced by a calibrated Verifier
(not the actor judging its own output)?"* If the loop is unbounded, the stop is subjective, there is no named
verify step, or the actor verified itself, it is step-execution dressed as a loop — the failure mode this unit
exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** Slice 0 of the execution engine counted as done only
when an independent verifier reproduced its criteria — a verified loop with an objective stop (the criteria) and
a hard cap (the gate blocks, it does not retry forever). §10.1(1) is honest that P1–P4 *as written* is a
step-executor that CAN cycle but is NOT a first-class verified-loop (no goal/stop/bound/named-verify), and that
shipping it as-is is exactly the retrofit the founder fears. The two named domains both exercise the pattern
(Mailbox classification/draft and Admin dunning-retry both loop act→verify→bounded-branch), which is why it
earns its place under the over-build guard.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from
`../delivery-os/capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md` §10 (git-sha `ea56546`), which STAYS as the
detailed source: §10.0 (the org's own DNA generalized), §10.1(2)/§10.2 (the three additions — maxAttempts
hard-cap + objective stop-predicate + back-edge), §10.1(3) (loop = PATTERN not primitive), §10.3 (the honest
hard part: the mechanics are cheap, the verifier is the work). The candidate-KU is named for promotion in §10.5.6
(line 569). Sibling: `ku-verifier-must-be-evaluated` (the strategic half — the verifier this loop is gated by).
This KU is the retrievable distilled form; the execution-model doc is preserved, not replaced.
