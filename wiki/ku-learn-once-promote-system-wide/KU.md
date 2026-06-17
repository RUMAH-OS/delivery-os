---
kuId: ku-learn-once-promote-system-wide
title: A validated learning is learned once, then made permanent and reusable system-wide
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A founder-discovered lesson should only need to be learned ONCE: after validation, the system remembers it permanently and makes it available wherever it is relevant. The load-bearing transition is project-specific knowledge → system-wide operational knowledge — a validated learning DETACHES from the workflow that discovered it and becomes reusable across every system (PLOS, Admin, Founder OS, and future systems), not re-learned per project. This permanence-plus-ubiquitous-reuse guarantee applies equally to ALL six pattern types (workflow · validation · handoff · health · governance · founder-review), so the knowledge lifecycle terminates not at 'canonical' but at 'system-wide reuse'."
triggers:
  - "did we already learn this"
  - "do we have to re-learn this lesson"
  - "should this lesson be system-wide or project-specific"
  - "where should this validated learning live so it is reused everywhere"
  - "detach this learning from the workflow that found it"
  - "learn once reuse everywhere"
  - "does the knowledge lifecycle end at canonical"
  - "make this learning permanent and reusable across systems"
  - "is this only an Admin lesson or a company-wide one"
topics:
  - learn-once-permanence
  - project-specific-to-system-wide
  - detach-learning-from-discovering-workflow
  - reuse-across-all-systems
  - lifecycle-terminates-in-system-wide-reuse
  - all-six-pattern-types
evidence-strength: founder-stated
cited-quote: "A founder-discovered lesson should only need to be learned once. After validation, the system remembers it permanently and makes it available wherever it is relevant."
source-provenance:
  earned-from: "Founder directive 2026-06-17 (learn-once permanence + system-wide reuse): a validated learning detaches from its discovering workflow and becomes reusable across PLOS/Admin/Founder OS + future systems; applies to all 6 pattern types"
  source-file: "../delivery-os/capabilities/KNOWLEDGE-ARCHITECTURE.md"
  anchor: "Header 'Companion founder principle (verbatim, 2026-06-17 — learn-once permanence + system-wide reuse)' (the verbatim quote) + §2 'Lifecycle terminus (founder principle, 2026-06-17)' which extends the lifecycle pipeline to 'System-Wide Reuse'"
  signal-pattern: null
  ratification-note: "Founder-STATED 2026-06-17, NOT yet founder-ratified — the canon home KNOWLEDGE-ARCHITECTURE.md is a DRAFT (founder holds the ratify gate). Held at founder-stated. Promote to founder-ratified when the founder ratifies the Knowledge Architecture / this principle."
related:
  - ku-real-usage-gaps-outrank-design-assumptions
  - ku-first-real-use-surfaces-invisible-gaps
  - ku-founder-discovered-failures-become-monitored-health-checks
  - ku-capability-governance-ladder
tags: [learning-loop, learn-once, system-wide-reuse, knowledge-permanence, lifecycle-terminus, founder-os]
---

# A validated learning is learned once, then made permanent and reusable system-wide

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A founder-discovered lesson should need to be learned only **once**. The founder's words:

> A founder-discovered lesson should only need to be learned once. After validation, the system remembers it
> permanently and makes it available wherever it is relevant.

The load-bearing transition is **project-specific knowledge → system-wide operational knowledge**: once a
learning is validated, it **detaches from the workflow that discovered it** and becomes reusable across every
system — PLOS, Admin, Founder OS, and future systems — rather than being re-discovered or re-learned per
project. The full lifecycle is:

> Real workflow → Learning → Validation → Durable knowledge → Wiki → Skill → System-wide reuse

and it applies equally to **all six pattern types**: workflow · validation · handoff · health · governance ·
founder-review. So the knowledge lifecycle does **not** terminate at "canonical" — its end state is
**system-wide reuse across all systems**.

**Why (the non-obvious reason).** It is tempting to treat a lesson as belonging to the workflow that surfaced
it (an "Admin invoicing gotcha", a "PLOS outreach quirk") and to re-encounter the same class of problem in the
next project. That keeps the company paying the learning cost repeatedly and lets the same trap recur in a
sibling system that never saw the original incident. The non-obvious move is that *validation is what earns a
learning the right to detach*: an unvalidated learning is still workflow-local (it might be noise), but a
**validated** one is a fact about how the company operates, and a fact has no project boundary. Permanence
(the system remembers it) + ubiquity (available wherever relevant) is what converts a one-time discovery into
a standing capability — and it must cover *all* pattern types, because a governance or handoff lesson is as
re-usable as a workflow lesson; restricting the guarantee to "lessons that look like bugs" leaks the loop's
value for the other five types.

**Boundary — what this KU is, and what it is NOT (reference, do not restate).**
- It is the **permanence + ubiquitous-reuse guarantee** and the **lifecycle terminus**. It is NOT:
- **WHERE** shared intelligence physically lives or HOW it is bucketed — that is
  `FOUNDER-OS-MIGRATION-PRINCIPLE.md` (the 6-bucket classifier, build-once-not-per-app, project-context stays
  in `CLAUDE.md`). This KU says a validated learning *must* reach system-wide reuse; that doc says *which
  structure* it lands in.
- **HOW** the lifecycle is mechanized (Harvester/Curator, retrieval hierarchy, the pipeline stages) — that is
  `KNOWLEDGE-ARCHITECTURE.md`. This KU only fixes the *terminus* of that pipeline (system-wide reuse) and that
  it spans all 6 pattern types.
- The **evidence value** of real usage — `ku-real-usage-gaps-outrank-design-assumptions` (usage outranks
  design) and `ku-first-real-use-surfaces-invisible-gaps` (first use exposes gaps). Those govern *which*
  learnings are worth keeping; this KU governs *what happens to one once validated*.
- The **enablement** decision (turning a capability on) — `ku-capability-governance-ladder`
  (exists→…→enabled). Reuse-everywhere is orthogonal to enabled-for-autonomy.

**How to apply (reusable).**
1. **Ask "have we learned this already?" first.** Before treating a lesson as new, route it through the
   knowledge layer; if a validated unit already covers it, reuse — do not re-learn.
2. **On validating a learning, classify its scope as system-wide by default.** A validated learning is company
   knowledge unless there is a specific reason it is genuinely project-local. Author it toward its canonical
   bucket (Wiki / Skill / Workflow / Health / Objective / Contract), not as fresh per-project prose.
3. **Detach it from its discovering workflow.** Strip the unit of incidental project framing so it reads as a
   reusable rule; keep the discovering instance only as a provenance anchor (`source-provenance`), not as the
   claim's scope.
4. **Make it reachable everywhere relevant.** Register it so every system that hits a relevant trigger is
   handed it through the seam (not a raw read), across PLOS / Admin / Founder OS / future systems.
5. **Apply to all six pattern types.** Run the same learn-once → durable → reusable flow for workflow,
   validation, handoff, health, governance, and founder-review patterns — not just bug-shaped lessons.
6. **Treat "the lifecycle ended at canonical" as incomplete.** A unit that is canonical but reachable from
   only one system has not finished the lifecycle; system-wide reuse is the terminus.

**The test.** Ask: *"this validated learning — is it remembered permanently and reachable from every system
where it is relevant, detached from the workflow that found it? Or is it still parked in the project that
discovered it, waiting to be re-learned elsewhere?"* A validated learning that a sibling system would have to
re-discover violates the rule.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** The founder's verbatim words are recorded on
disk in the Founder-OS canon `../capabilities/KNOWLEDGE-ARCHITECTURE.md` — the header "Companion founder
principle (verbatim, 2026-06-17 — learn-once permanence + system-wide reuse)" — and that doc's §2 lifecycle was
extended to terminate in "System-Wide Reuse (all systems, all 6 pattern types)". That doc STAYS as the on-disk
source. This KU is the retrievable distilled form. Held at **founder-stated** (not founder-ratified): the canon
home is a DRAFT and the founder holds the ratify gate.
