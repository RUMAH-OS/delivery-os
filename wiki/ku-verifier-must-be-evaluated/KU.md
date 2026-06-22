---
kuId: ku-verifier-must-be-evaluated
title: A Verifier must itself be evaluated before it may GATE — an un-evaluated verifier may only ADVISE (eval-the-evaluator)
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A Verifier is a strategic, reusable, catalog-registered capability — and it MUST itself be evaluated/calibrated before it is allowed to GATE (eval-the-evaluator). An un-evaluated / not-yet-enabled verifier may only ADVISE (run in shadow: its verdict is recorded but does NOT stop or branch the loop), never GATE; it earns the right to gate by climbing the SAME capability governance ladder every capability climbs (exists→reachable→validated→observable→trusted→enabled). Deterministic rule-checks (T1) are exempt — a rule is its own proof. Prefer the highest-trust verifier the criterion admits (deterministic → rubric → confidence → judge) and fall back to a human-approval verifier (the unbypassable floor for anything irreversible/subjective) when no objective verifier has earned enough trust. The differentiator is verifier QUALITY + the eval infrastructure, NOT loop mechanics."
triggers:
  - "can this verifier be trusted to gate"
  - "is this verifier calibrated / evaluated"
  - "can the verifier stop or branch the loop"
  - "eval the evaluator"
  - "should the verifier gate or only advise"
  - "what verifier type should I use"
  - "is self-reported confidence trustworthy"
  - "maker-checker scorer eval"
  - "approval as verification"
  - "verifier quality"
topics:
  - verifier-must-be-evaluated
  - eval-the-evaluator
  - advise-vs-gate-rule
  - verifier-type-taxonomy-t1-t5
  - prefer-objective-fall-back-to-human
  - verifier-is-a-catalog-capability
evidence-strength: runtime-evidenced
cited-quote: "A Verifier must ITSELF be evaluated before it is allowed to GATE."
source-provenance:
  earned-from: "Founder directive — Verification treated as a strategic Delivery OS capability ('the real differentiator will be verifier quality'), modelled fully in DELIVERY-OS-EXECUTION-MODEL-V1.md §10.5 (the Verifier contract, the T1–T5 trust-ranked taxonomy, eval-the-evaluator, the catalog registration, the 5-domain reuse table)"
  source-file: "../delivery-os/capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md"
  anchor: "§10.5 (lines 434–586): §10.5.1 Verifier contract; §10.5.2 T1–T5 trust-ranked taxonomy (lines 476–493); §10.5.3 eval-the-evaluator + the governance-ladder gating rule + the advise-vs-gate fail-safe (lines 495–522); §10.5.4 catalog capability (lines 524–536); §10.5.5 the 5-domain reuse table (lines 538–554). Candidate-KU named in §10.5.6 (line 573)."
  git-sha: "ea56546"
  signal-pattern: null
  ratification-note: "Founder-ratified intent that verification is a strategic, evaluated Delivery OS capability ('the real differentiator will be verifier quality'), BUT the source §10.5 is DESIGN-ONLY (no build/wiring; eval suites + calibration not built) — so this KU is held at runtime-evidenced. Promote to founder-ratified strength once a non-T1 verifier is registered, calibrated, and earns the enabled rung under a real eval suite (author≠verifier). DRAFTED by knowledge-engineer; author≠verifier — NOT self-certified."
related:
  - ku-capability-governance-ladder
  - ku-enable-capabilities-on-trust-not-existence
  - ku-implemented-is-not-operationally-proven
  - ku-verify-seam-by-one-real-round-trip
tags: [execution-model, verifier, verification, eval-the-evaluator, calibration, maker-checker, capability-governance, author-not-equal-verifier, founder-os]
---

# A Verifier must itself be evaluated before it may GATE — un-evaluated verifiers may only ADVISE

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A Verifier is the strategic, reusable, EVALUATED capability where the value of a verified
loop moves — and it carries one load-bearing, non-obvious obligation:

> A Verifier must ITSELF be evaluated before it is allowed to GATE.

A Verifier is a registered **capability** (a manifest + the standard facets + a governance-ladder status,
discoverable + invoked by id) — *not* engine surface. It IS the loop's objective stop condition made an
interface: `verify(input) → { verdict: pass|fail|needs_improvement, score?, confidence, reasons,
suggestedImprovement? }`. Because the loop branches on its verdict (`ku-verified-loop-execution`), the loop's
safety **is** the verifier's calibration.

**The advise-vs-gate rule (the fail-safe).** *An un-evaluated / not-yet-enabled Verifier may only ADVISE, never
GATE.* Below the *enabled* rung it runs in **shadow**: its verdict is recorded/emitted (building the eval
evidence) but does NOT stop or branch the loop — the loop's real stop condition stays a human-approval (T5) until
the verifier's calibration earns the *enabled* rung. **T1 deterministic checks are exempt** (a rule is its own
proof: it cannot be miscalibrated, only mis-specified). This is the construction-level guard against a
confident-but-wrong gate.

**It earns the right to gate via the SAME governance ladder.** A verifier is just a capability, so "may it
GATE?" is exactly the `ku-capability-governance-ladder` question — it climbs **exists → reachable → validated
(eval suite passes a stated bar, author≠verifier) → observable (its verdicts + reasons emitted) → trusted
(calibration holds on real data) → enabled (allowed to GATE autonomously)**. "Built but not yet allowed to gate"
is precisely `ku-implemented-is-not-operationally-proven` applied to verifiers, and "do not let it gate just
because it exists" is `ku-enable-capabilities-on-trust-not-existence`. This unit is the runtime generalization of
the org's own author≠verifier / verify-gate / §11 discipline turned on the *verifier itself*: the checker, too,
must be independently evaluated before it is trusted.

**Why (the non-obvious reason).** A weak/uncalibrated verifier is **worse than no loop**: it confidently iterates
a bounded loop toward a WRONG objective, or stops `pass` when it should have failed — manufacturing false
confidence at machine speed. A loop's verdict is believed, so a wrong verdict propagates as a trusted fact (the
same "a trusted-but-wrong artifact is worse than an unverified one" trap as author≠verifier). That is why the
real investment and the real differentiator are the **eval infrastructure** — objective stop criteria, labelled
eval suites, calibration measurement, and the advise→gate promotion gate — **not** the loop engine (two fields
and a back-edge, near-proven). Self-reported confidence is the sharpest case: a model's stated `confidence: 0.9`
is worthless until you have measured that it actually means ~90% right. An un-evalled LLM-judge (T4) is the most
dangerous of all — confident, plausible, and wrong — so it needs evals most strongly.

**Prefer objective; fall back to human (the T1–T5 trust ranking).** Use the highest-trust verifier the criterion
admits; fall back down the ladder only when no higher type is trustworthy enough; the bottom rung (human) is
always available.

| # | Type | Trust | Needs evals before it may GATE? |
|---|---|---|---|
| T1 | Deterministic check (a rule/assertion over facts) | HIGHEST | NO — it is its own proof |
| T2 | Rubric scorer (threshold-gated) | HIGH | YES — calibrate the threshold/rubric |
| T3 | Classifier-confidence (the actor's own confidence) | MEDIUM | YES — self-confidence is worthless until calibrated |
| T4 | LLM-judge / maker-checker (a SEPARATE agent scores) | MEDIUM (powerful but opaque) | YES — strongly; the most dangerous un-evalled |
| T5 | Human-approval (a human IS the verifier) | CONTEXT-HIGHEST for irreversible/subjective | N/A — the human is the ground truth |

The ranking is the design guidance: *invest in making criteria objective* (push T4→T2→T1 where a criterion can
be expressed as a rule). **T5 (human) is the canonical fallback** — the unbypassable floor for anything
irreversible, subjective, or where no objective verifier has earned enough trust to gate; it unifies with
human-in-the-loop (a human gate is just a Verifier of type human-approval whose verdict posts via the
human-response callback). One model now covers approval AND verification.

**It is a catalog capability — declared once, reused across loops.** A Verifier is registered like any
capability (manifest, facets, invoke descriptor, governance status), so a confidence-threshold verifier or an
llm-judge rubric is authored ONCE and reused across Mailbox / Contact / Outreach / Jarvis — not re-implemented
per domain. The reuse is the strategic point: T3 confidence recurs across Mailbox + Contact + Outreach; T2 rubric
across Mailbox + Outreach; T4 judge across Mailbox + Contact; T1 deterministic across Contact + Outreach
(compliance); T5 human-approval is the shared floor across all of them. A goal-success verifier (Jarvis) COMPOSES
the domain verifiers by id rather than re-implementing them. A verifier that must read Contact PII to judge runs
in the PII-owning system (carried as a manifest fact), and only its Verdict crosses the seam — never the PII it
read.

**How to apply (domain-stripped, reusable).**
1. **Register the verifier as a capability, not engine code.** Give it the uniform `verify(input) → Verdict`
   contract, a manifest, and a governance-ladder status. One verifier, many loops.
2. **Pick the highest-trust type the criterion admits.** Express the done-criteria as a rule (T1) if you can;
   else a calibrated rubric (T2) or confidence threshold (T3); use an LLM-judge (T4) only when the others can't;
   reserve human-approval (T5) as the floor for irreversible/subjective.
3. **Evaluate before you let it gate.** Every non-T1 verifier carries an eval suite (labelled true-pass /
   true-fail / known-hard cases) and a measured calibration. Until it passes the bar and climbs to *enabled*, it
   runs in shadow and may only ADVISE — the loop's real stop stays a human-approval (T5).
4. **Re-find the calibration before trusting a gate.** Treat "this verifier may gate" as a claim to be
   independently verified (author≠verifier on the eval suite), never a self-assertion — the checker is held to
   the same independence it enforces on everyone else.
5. **Spend the effort here, keep the engine minimal.** The loop mechanics are cheap; the founder gating and the
   investment belong on *which verifiers are trusted enough to GATE* and the eval infrastructure behind them.

**The test for any "this verifier gates the loop" claim.** Ask: *"is this verifier T1 (a rule, exempt), or has
it been EVALUATED — an eval suite, measured calibration, climbed to the enabled rung under author≠verifier — and
is it currently allowed to GATE rather than only ADVISE?"* If a non-T1 verifier gates without an eval suite and
the enabled rung, it is a confident-but-wrong gate waiting to happen — the failure mode this unit exists to
prevent.

**Runtime evidence anchor (the load-bearing instance).** §10.5.3 names eval-the-evaluator as the load-bearing,
non-obvious claim and the real differentiator, and §10.5.7 is honest that the loop mechanics are solved and cheap
while "the hard, high-value, high-risk work is verifier QUALITY + the EVAL INFRASTRUCTURE" — a confident wrong
verifier gating a bounded loop is the failure mode, and it is silent. The advise-vs-gate rule + the
governance-ladder gating sequence (§10.5.3, lines 506–517) are exactly the construction-level guard. The
5-domain reuse table (§10.5.5) demonstrates the same T1–T5 types recurring across domains — the strategic
reusability the founder asked to see.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from
`../delivery-os/capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md` §10.5 (git-sha `ea56546`), which STAYS as the
detailed source: §10.5.1 (the Verifier contract), §10.5.2 (the T1–T5 trust-ranked taxonomy), §10.5.3
(eval-the-evaluator + the governance-ladder gating rule + the advise-vs-gate fail-safe), §10.5.4 (the catalog
capability), §10.5.5 (the 5-domain reuse table). The candidate-KU is named for promotion in §10.5.6 (line 573).
Sibling: `ku-verified-loop-execution` (the loop this verifier gates). This KU is the retrievable distilled form;
the execution-model doc is preserved, not replaced.
