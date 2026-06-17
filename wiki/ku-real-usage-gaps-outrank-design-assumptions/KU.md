---
kuId: ku-real-usage-gaps-outrank-design-assumptions
title: A gap found through real workflow usage outranks an assumption from design discussion
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A gap discovered by running a REAL workflow is higher-value evidence than an assumption produced in design discussion, and should outrank it when the two disagree. This is because the Founder-OS/Jarvis learning loop runs forward — workflows generate learning → learning becomes knowledge → knowledge becomes capability — so real usage is the source of truth that design assumptions are downstream of, not the other way round; a design assumption contradicted by a real-usage finding is the assumption that must yield."
triggers:
  - "design says X but real usage shows Y"
  - "is this gap real or just assumed"
  - "which is stronger — the design assumption or the usage finding"
  - "should we trust the design doc or what actually happened"
  - "real workflow surfaced a different answer"
  - "how does usage become capability"
  - "where does learning come from"
  - "founder-os learning loop"
topics:
  - real-usage-outranks-design-assumption
  - workflow-learning-loop
  - usage-as-source-of-truth
  - learning-becomes-capability
  - design-assumption-must-yield
evidence-strength: runtime-evidenced
cited-quote: "workflows generate learning → learning becomes knowledge → knowledge becomes capability"
source-provenance:
  earned-from: "Founder directive 2026-06-17 (real-usage learnings) + the first real-intent consumption run that surfaced gaps a design discussion had not"
  source-file: "../delivery-os/capabilities/CAPABILITY-GOVERNANCE-LADDER.md"
  anchor: "'Founder directive 2026-06-17 — verbatim source quotes' (the learning-loop line: workflows→learning→knowledge→capability). Evidence: ../../rumah-admin/docs/verify/VERIFY-consumption-real-intents-2026-06-17.md — the 'Honest gaps' GAP-1…GAP-5 surfaced by running real intents"
  signal-pattern: null
  ratification-note: "Canon source CAPABILITY-GOVERNANCE-LADDER.md is Status: ratified-pending (DRAFT until ratified; founder holds the merge gate) — so this KU is held at runtime-evidenced, NOT founder-ratified. Promote to founder-ratified when the founder ratifies CAPABILITY-GOVERNANCE-LADDER."
related:
  - ku-first-real-use-surfaces-invisible-gaps
  - ku-implemented-is-not-operationally-proven
  - ku-founder-discovered-failures-become-monitored-health-checks
tags: [learning-loop, real-usage, evidence-ranking, design-vs-reality, founder-os]
---

# A gap found through real usage outranks an assumption from design discussion

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** When a gap discovered by **running a real workflow** disagrees with an **assumption made
in design discussion**, the real-usage finding wins. Real usage is higher-value evidence because the
Founder-OS/Jarvis learning loop runs in exactly that direction:

> workflows generate learning → learning becomes knowledge → knowledge becomes capability

Design assumptions sit *downstream* of real usage in this loop, so a design assumption contradicted by a
real-usage finding is the assumption that must yield.

**Why (the non-obvious reason).** Design discussion produces *hypotheses about* a workflow; running the workflow
produces *facts from* it. The two feel comparable in a meeting — both are articulate, both have advocates — but
they are not the same evidence class. A design assumption is a prediction; a usage finding is an observation
that has already survived contact with reality (real data, real phrasing, real selection, real side-effects).
When they conflict, treating them as equal (or worse, defending the design because it is "the plan") inverts
the learning loop: it lets a prediction override an observation, which is how teams keep re-deciding a question
the workflow already answered. The loop only compounds value if usage is allowed to *update* design, not the
reverse.

**How to apply (reusable).**
1. **Rank evidence by where it came from.** A finding from a real workflow run ranks above an assumption from
   design discussion. Label each as what it is (observed-in-use vs assumed-in-design) so the rank is visible.
2. **When they conflict, the assumption yields — and gets updated.** Do not "resolve" a usage-finding-vs-design
   conflict by re-stating the design. Update the design (or the plan, or the catalog) to match what real usage
   showed, and record why.
3. **Close the loop: turn the usage gap into knowledge, then capability.** A real-usage gap is not just a bug
   list — it is fuel. Promote it (a KU, a backlog item, a new capability) so workflows→learning→knowledge→
   capability actually completes; an unpromoted usage finding leaks the loop's value.
4. **Prefer generating real-usage evidence over extending design debate.** When a question is contested in
   design, the cheapest decisive move is usually to *run the workflow once for real* and observe, rather than
   argue the assumption further.

**The test.** Ask: *"is this conclusion an observation from a real workflow run, or an assumption from design
discussion — and if a real-usage finding contradicts a design assumption, am I letting the assumption win?"*
If a prediction is overriding an observation, the rule is being violated.

**Runtime evidence anchor (the load-bearing instance — Rumah Admin).** Running the consumption loop on the
founder's REAL operator-queue intents (2026-06-17) produced findings that no design discussion had surfaced:
the #1-pain "send … invoices" intent silently mis-selects a generic mailer over the purpose-built invoice send
(GAP-1/DEFECT-CONSUME-1); a control read intent mis-discovers because the tokenizer has no stemming (GAP-3);
and there is no first-class capability for a literal queued task. These are observations from a real run, and
they outrank the prior design-time assumption that the discover/select model was sound — see
`ku-first-real-use-surfaces-invisible-gaps` for the same run viewed as a first-use proof.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** The cited learning-loop is recorded verbatim
in the Founder-OS canon `../capabilities/CAPABILITY-GOVERNANCE-LADDER.md` ("Founder directive 2026-06-17 —
verbatim source quotes"), the on-disk home of the founder's 2026-06-17 directive. The real-intent run that is
the load-bearing evidence, `../../rumah-admin/docs/verify/VERIFY-consumption-real-intents-2026-06-17.md` (the
"Honest gaps" GAP-1…GAP-5), STAYS as the detailed evidence source. This KU is the retrievable distilled form;
the canon doc and the verify report are preserved, not replaced.
